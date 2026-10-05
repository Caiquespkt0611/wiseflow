"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { DespesaFixaForm, DespesaFixaFormData } from "@/components/forms/DespesaFixaForm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { sortList, type SortState } from "@/components/ui/SortTh";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Linha, BotaoIcone, BotaoExcluir } from "@/components/ui/Linha";
import { BarraBusca } from "@/components/ui/BarraBusca";
import { Vazio } from "@/components/ui/Vazio";

interface DespesaFixa {
  id: string;
  descricao: string;
  valor: number;
  responsavel: string;
  recorrente: boolean;
  ativa: boolean;
  dataInicio: string;
  dataProximoVencimento: string | null;
}

export default function DespesasFixasPage() {
  const [items, setItems] = useState<DespesaFixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DespesaFixa | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [date, setDate] = useState(new Date());
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const mes = date.getMonth() + 1;
  const ano = date.getFullYear();
  const now = new Date();
  const isCurrentMonth = now.getMonth() + 1 === mes && now.getFullYear() === ano;
  const mesLabel = format(date, "MMM/yy", { locale: ptBR });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/despesas-fixas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  const handleCreate = async (data: DespesaFixaFormData) => {
    setSaving(true);
    const res = await fetch("/api/despesas-fixas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); toast("Despesa criada"); }
    else toast("Erro ao criar despesa", "error");
  };

  const handleEdit = async (data: DespesaFixaFormData) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/despesas-fixas/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); toast("Despesa atualizada"); }
    else toast("Erro ao atualizar despesa", "error");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa fixa?")) return;
    const res = await fetch(`/api/despesas-fixas/${id}`, { method: "DELETE" });
    if (res.ok) { fetchData(); toast("Despesa excluída"); }
    else toast("Erro ao excluir despesa", "error");
  };

  const handleConfirmar = async (item: DespesaFixa) => {
    setLoadingActionId(item.id);
    let year: number;
    let month: number;
    if (item.dataProximoVencimento) {
      const d = new Date(item.dataProximoVencimento);
      year = d.getUTCFullYear();
      month = d.getUTCMonth();
    } else {
      const d = new Date();
      year = d.getFullYear();
      month = d.getMonth();
    }
    const proximo = addMonths(new Date(year, month, 1), 1);
    const res = await fetch(`/api/despesas-fixas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataProximoVencimento: format(proximo, "yyyy-MM-dd") }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Pagamento confirmado"); }
    else toast("Erro ao confirmar pagamento", "error");
  };

  const handleReverter = async (item: DespesaFixa) => {
    if (!item.dataProximoVencimento) return;
    setLoadingActionId(item.id);
    const prox = new Date(item.dataProximoVencimento);
    const prevMonth = subMonths(new Date(prox.getUTCFullYear(), prox.getUTCMonth(), 1), 1);
    const ini = new Date(item.dataInicio);
    const prevIsAtOrBeforeStart =
      prevMonth.getFullYear() < ini.getUTCFullYear() ||
      (prevMonth.getFullYear() === ini.getUTCFullYear() && prevMonth.getMonth() + 1 <= ini.getUTCMonth() + 1);
    const res = await fetch(`/api/despesas-fixas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataProximoVencimento: prevIsAtOrBeforeStart ? null : format(prevMonth, "yyyy-MM-dd") }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Pagamento desfeito"); }
    else toast("Erro ao desfazer pagamento", "error");
  };

  const openEdit = (item: DespesaFixa) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? { ...selected, dataInicio: selected.dataInicio.slice(0, 10) }
    : undefined;

  // Item appeared in selected month: started in this month or before (UTC comparison)
  const isActiveInMonth = (item: DespesaFixa): boolean => {
    const d = new Date(item.dataInicio);
    const iniAno = d.getUTCFullYear();
    const iniMes = d.getUTCMonth() + 1;
    return iniAno < ano || (iniAno === ano && iniMes <= mes);
  };

  // Item was paid for selected month: next due date (UTC) is in a month after this one
  const isPagaInMonth = (item: DespesaFixa): boolean => {
    if (!item.dataProximoVencimento) return false;
    const prox = new Date(item.dataProximoVencimento);
    const proxAno = prox.getUTCFullYear();
    const proxMes = prox.getUTCMonth() + 1;
    return proxAno > ano || (proxAno === ano && proxMes > mes);
  };

  const sorters: Partial<Record<string, (i: DespesaFixa) => string | number>> = {
    descricao: (i) => i.descricao.toLowerCase(),
    responsavel: (i) => i.responsavel.toLowerCase(),
    dataInicio: (i) => i.dataInicio,
    valor: (i) => i.valor,
  };

  const ativas = items.filter((i) => i.ativa && isActiveInMonth(i));

  const aplicarFiltro = (list: DespesaFixa[]) =>
    sortList(
      filtro
        ? list.filter(
            (i) =>
              i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
              i.responsavel.toLowerCase().includes(filtro.toLowerCase())
          )
        : list,
      sort,
      sorters
    );

  const pendentes = aplicarFiltro(ativas.filter((i) => !isPagaInMonth(i)));
  const pagas = aplicarFiltro(ativas.filter((i) => isPagaInMonth(i)));
  const totalPendentes = pendentes.reduce((sum, i) => sum + i.valor, 0);

  const diaVence = (item: DespesaFixa) => formatDate(item.dataInicio).slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto">
      <Cabecalho
        titulo="Contas do mês"
        subtitulo={
          loading ? undefined : (
            <>
              Falta pagar em {mesLabel}: <span className="valor font-medium text-tinta-900">{formatCurrency(totalPendentes)}</span>
            </>
          )
        }
      >
        <MonthSelector date={date} onChange={setDate} />
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-marca hover:bg-marca-forte text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova conta
        </button>
      </Cabecalho>

      {loading ? (
        <div className="space-y-3" aria-busy>
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-tinta-100 animate-pulse" />)}
        </div>
      ) : items.filter((i) => i.ativa).length === 0 ? (
        <Vazio texto="Nenhuma conta do mês ainda. Aluguel, luz, escola, academia." acao="Lançar a primeira" />
      ) : (
        <>
          <BarraBusca
            valor={filtro}
            aoMudar={setFiltro}
            placeholder="Buscar conta ou pessoa"
            sort={sort}
            aoOrdenar={setSort}
            ordens={[
              { rotulo: "Maior valor", key: "valor", dir: "desc" },
              { rotulo: "Nome", key: "descricao", dir: "asc" },
            ]}
          />

          {pendentes.length === 0 && pagas.length === 0 ? (
            <p className="py-10 text-center text-sm text-tinta-500">Nenhuma conta em {mesLabel}{filtro ? " com essa busca" : ""}.</p>
          ) : (
            <div className="space-y-3">
              {pendentes.length > 0 && (
                <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                  {pendentes.map((item) => (
                    <Linha
                      key={item.id}
                      titulo={item.descricao}
                      aoAbrir={() => openEdit(item)}
                      detalhe={`Vence dia ${diaVence(item)}, ${item.responsavel}`}
                      valor={formatCurrency(item.valor)}
                      acoes={
                        <>
                          {isCurrentMonth && (
                            <BotaoIcone rotulo="Marcar como paga" onClick={() => handleConfirmar(item)} disabled={loadingActionId === item.id}>
                              <CheckCircle2 className="w-[18px] h-[18px]" />
                            </BotaoIcone>
                          )}
                          <BotaoIcone rotulo="Editar" soComputador onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </BotaoIcone>
                          <BotaoIcone rotulo="Excluir" perigo soComputador onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </BotaoIcone>
                        </>
                      }
                    />
                  ))}
                </section>
              )}

              {pagas.length > 0 && (
                <section>
                  <h2 className="px-1 mb-2 text-xs font-medium text-tinta-500">Pagas em {mesLabel}</h2>
                  <div className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                    {pagas.map((item) => (
                      <Linha
                        key={item.id}
                        apagada
                        titulo={item.descricao}
                        aoAbrir={() => openEdit(item)}
                        detalhe={`Paga, dia ${diaVence(item)}, ${item.responsavel}`}
                        valor={formatCurrency(item.valor)}
                        acoes={
                          <>
                            <BotaoIcone rotulo="Desfazer pagamento" onClick={() => handleReverter(item)} disabled={loadingActionId === item.id}>
                              <RotateCcw className="w-4 h-4" />
                            </BotaoIcone>
                            <BotaoIcone rotulo="Editar" soComputador onClick={() => openEdit(item)}>
                              <Pencil className="w-4 h-4" />
                            </BotaoIcone>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      {modal === "create" && (
        <Modal title="Nova conta do mês" onClose={() => setModal(null)}>
          <DespesaFixaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar conta do mês" onClose={() => { setModal(null); setSelected(null); }}>
          <DespesaFixaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
          <BotaoExcluir onClick={() => { handleDelete(selected.id); setModal(null); setSelected(null); }} />
        </Modal>
      )}
    </div>
  );
}
