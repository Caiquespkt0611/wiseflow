"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw, ChevronDown } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { ReceitaVariavelForm, ReceitaVariavelPayload } from "@/components/forms/ReceitaVariavelForm";
import { sortList, type SortState } from "@/components/ui/SortTh";
import { confirmadaNoMes, formatCurrency, formatDate } from "@/lib/utils";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Linha, BotaoIcone, BotaoExcluir } from "@/components/ui/Linha";
import { BarraBusca } from "@/components/ui/BarraBusca";
import { Vazio } from "@/components/ui/Vazio";
import { useAoLancar } from "@/lib/eventos";

interface ReceitaVariavel {
  id: string;
  descricao: string;
  fonte: string;
  categoria: string;
  valorTotal: number;
  parcelaAtual: number;
  parcelasTotal: number;
  valorParcela: number;
  responsavel: string;
  dataInicio: string;
  confirmadaAte: string | null;
}

export default function ReceitasVariaveisPage() {
  const [items, setItems] = useState<ReceitaVariavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<ReceitaVariavel | null>(null);
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
    const res = await fetch("/api/receitas-variaveis");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  const getParcelaForMonth = (item: ReceitaVariavel) => {
    const inicio = new Date(item.dataInicio);
    const diffMeses = (ano - inicio.getUTCFullYear()) * 12 + (mes - 1 - inicio.getUTCMonth());
    return item.parcelaAtual + diffMeses;
  };

  const isActiveInMonth = (item: ReceitaVariavel) => {
    const p = getParcelaForMonth(item);
    return p >= 1 && p <= item.parcelasTotal;
  };

  const isConfirmadaInMonth = (item: ReceitaVariavel) =>
    confirmadaNoMes(item.dataInicio, item.confirmadaAte, mes, ano);

  const handleCreate = async (data: ReceitaVariavelPayload) => {
    setSaving(true);
    const res = await fetch("/api/receitas-variaveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); toast("Receita criada"); }
    else toast("Erro ao criar receita", "error");
  };

  const handleEdit = async (data: ReceitaVariavelPayload) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/receitas-variaveis/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); toast("Receita atualizada"); }
    else toast("Erro ao atualizar receita", "error");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita variável?")) return;
    const res = await fetch(`/api/receitas-variaveis/${id}`, { method: "DELETE" });
    if (res.ok) { fetchData(); toast("Receita excluída"); }
    else toast("Erro ao excluir receita", "error");
  };

  const handleConfirmar = async (item: ReceitaVariavel) => {
    setLoadingActionId(item.id);
    const d = new Date(item.dataInicio);
    const novaData = format(addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1), "yyyy-MM-dd");
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    // Receber = avança o vencimento E o ponteiro da próxima parcela não recebida.
    const res = await fetch(`/api/receitas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataInicio: novaData, confirmadaAte, parcelaAtual: item.parcelaAtual + 1 }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Recebimento confirmado"); }
    else toast("Erro ao confirmar recebimento", "error");
  };

  const handleReverterReceitaVar = async (item: ReceitaVariavel) => {
    setLoadingActionId(item.id);
    const d = new Date(item.dataInicio);
    const prevInicio = subMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
    const res = await fetch(`/api/receitas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataInicio: format(prevInicio, "yyyy-MM-dd"), confirmadaAte: null, parcelaAtual: Math.max(1, item.parcelaAtual - 1) }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Recebimento desfeito"); }
    else toast("Erro ao desfazer recebimento", "error");
  };

  const openEdit = (item: ReceitaVariavel) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? {
        descricao: selected.descricao,
        fonte: selected.fonte,
        categoria: selected.categoria ?? "Outros",
        valorParcela: selected.valorParcela,
        parcelasTotal: Math.max(selected.parcelasTotal - (selected.parcelaAtual - 1), 1),
        responsavel: selected.responsavel,
        dataInicio: selected.dataInicio.slice(0, 10),
      }
    : undefined;

  const sorters: Partial<Record<string, (i: ReceitaVariavel) => string | number>> = {
    descricao: (i) => i.descricao.toLowerCase(),
    fonte: (i) => i.fonte.toLowerCase(),
    responsavel: (i) => i.responsavel.toLowerCase(),
    valorParcela: (i) => i.valorParcela,
    dataInicio: (i) => i.dataInicio,
  };

  const filtrados = filtro
    ? items.filter(
        (i) =>
          i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.fonte.toLowerCase().includes(filtro.toLowerCase()) ||
          i.responsavel.toLowerCase().includes(filtro.toLowerCase())
      )
    : items;

  const ativas = filtrados.filter(isActiveInMonth);
  const confirmadasFora = filtrados.filter((i) => !isActiveInMonth(i) && isConfirmadaInMonth(i));

  const aplicarSort = (list: ReceitaVariavel[]) => sortList(list, sort, sorters);

  const pendentes = aplicarSort(ativas.filter((i) => !isConfirmadaInMonth(i)));
  const recebidas = aplicarSort([...ativas.filter(isConfirmadaInMonth), ...confirmadasFora]);

  // Concluídas: all installments done as of today
  const nowMes = now.getMonth() + 1;
  const nowAno = now.getFullYear();
  const concluidas = aplicarSort(
    filtrados.filter((i) => {
      const inicio = new Date(i.dataInicio);
      const diffMeses = (nowAno - inicio.getUTCFullYear()) * 12 + (nowMes - 1 - inicio.getUTCMonth());
      return i.parcelaAtual + diffMeses > i.parcelasTotal;
    })
  );

  const totalMensal = pendentes.reduce((sum, i) => sum + i.valorParcela, 0);
  const isEmpty = pendentes.length === 0 && recebidas.length === 0;

  const detalhe = (item: ReceitaVariavel, prefixo = "") => {
    const parcela = Math.max(1, Math.min(getParcelaForMonth(item), item.parcelasTotal));
    return `${prefixo}${parcela} de ${item.parcelasTotal}, ${item.fonte}, ${item.responsavel}, dia ${formatDate(item.dataInicio).slice(0, 5)}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Cabecalho
        titulo="Receitas parceladas"
        subtitulo={
          loading ? undefined : (
            <>
              Falta receber em {mesLabel}: <span className="valor font-medium text-marca-700">{formatCurrency(totalMensal)}</span>
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
          Nova receita
        </button>
      </Cabecalho>

      {loading ? (
        <div className="space-y-3" aria-busy>
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-tinta-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Vazio texto="Nenhuma receita parcelada ainda." acao="Lançar a primeira" />
      ) : (
        <>
          <BarraBusca
            valor={filtro}
            aoMudar={setFiltro}
            placeholder="Buscar receita, fonte ou pessoa"
            sort={sort}
            aoOrdenar={setSort}
            ordens={[
              { rotulo: "Próximas primeiro", key: "dataInicio", dir: "asc" },
              { rotulo: "Maior valor", key: "valorParcela", dir: "desc" },
              { rotulo: "Nome", key: "descricao", dir: "asc" },
            ]}
          />

          {isEmpty && concluidas.length === 0 ? (
            <p className="py-10 text-center text-sm text-tinta-500">Nada a receber em {mesLabel}{filtro ? " com essa busca" : ""}.</p>
          ) : (
            <div className="space-y-3">
              {pendentes.length > 0 && (
                <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                  {pendentes.map((item) => (
                    <Linha
                      key={item.id}
                      titulo={item.descricao}
                      aoAbrir={() => openEdit(item)}
                      detalhe={detalhe(item)}
                      valor={formatCurrency(item.valorParcela)}
                      valorClasse="text-marca-700"
                      acoes={
                        <>
                          {isCurrentMonth && (
                            <BotaoIcone rotulo="Marcar como recebida" onClick={() => handleConfirmar(item)} disabled={loadingActionId === item.id}>
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

              {recebidas.length > 0 && (
                <section>
                  <h2 className="px-1 mb-2 text-xs font-medium text-tinta-500">Recebidas em {mesLabel}</h2>
                  <div className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                    {recebidas.map((item) => (
                      <Linha
                        key={item.id}
                        apagada
                        titulo={item.descricao}
                        aoAbrir={() => openEdit(item)}
                        detalhe={detalhe(item, "Recebida, ")}
                        valor={formatCurrency(item.valorParcela)}
                        acoes={
                          <>
                            <BotaoIcone rotulo="Desfazer recebimento" onClick={() => handleReverterReceitaVar(item)} disabled={loadingActionId === item.id}>
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

              {concluidas.length > 0 && (
                <details className="group rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 cursor-pointer list-none hover:bg-tinta-50">
                    <span className="text-sm text-tinta-600">Concluídas ({concluidas.length})</span>
                    <ChevronDown className="w-4 h-4 text-tinta-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="divide-y divide-tinta-100 border-t border-tinta-100">
                    {concluidas.map((item) => (
                      <Linha
                        key={item.id}
                        apagada
                        titulo={item.descricao}
                        aoAbrir={() => openEdit(item)}
                        detalhe={`${item.parcelasTotal}x, ${item.fonte}, ${item.responsavel}`}
                        valor={formatCurrency(item.valorParcela)}
                        acoes={
                          <BotaoIcone rotulo="Excluir" perigo soComputador onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </BotaoIcone>
                        }
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {modal === "create" && (
        <Modal title="Nova receita parcelada" onClose={() => setModal(null)}>
          <ReceitaVariavelForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar receita parcelada" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaVariavelForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
          <BotaoExcluir onClick={() => { handleDelete(selected.id); setModal(null); setSelected(null); }} />
        </Modal>
      )}
    </div>
  );
}
