"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Search, ChevronDown, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { DespesaVariavelForm, DespesaVariavelPayload } from "@/components/forms/DespesaVariavelForm";
import { cn, confirmadaNoMes, formatCurrency, formatDate } from "@/lib/utils";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Linha, BotaoIcone, BotaoExcluir } from "@/components/ui/Linha";
import { Vazio } from "@/components/ui/Vazio";
import { useAoLancar } from "@/lib/eventos";

interface DespesaVariavel {
  id: string;
  descricao: string;
  cartao: string;
  valorTotal: number;
  parcelaAtual: number;
  parcelasTotal: number;
  valorParcela: number;
  responsavel: string;
  categoria: string;
  dataInicio: string;
  confirmadaAte: string | null;
}

type CardGroup = {
  cartao: string;
  pendentes: { item: DespesaVariavel; parcela: number }[];
  pagas: { item: DespesaVariavel; parcela: number }[];
  totalPendente: number;
};

export default function DespesasVariaveisPage() {
  const [items, setItems] = useState<DespesaVariavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DespesaVariavel | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [date, setDate] = useState(new Date());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const mes = date.getMonth() + 1;
  const ano = date.getFullYear();
  const now = new Date();
  const isCurrentMonth = now.getMonth() + 1 === mes && now.getFullYear() === ano;
  const mesLabel = format(date, "MMM/yy", { locale: ptBR });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/despesas-variaveis");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  // Unique card names from this user's data (for datalist suggestions)
  const cartoesExistentes = Array.from(new Set(items.map((i) => i.cartao).filter(Boolean))).sort();

  const getParcelaForMonth = (item: DespesaVariavel) => {
    const inicio = new Date(item.dataInicio);
    const diffMeses = (ano - inicio.getUTCFullYear()) * 12 + (mes - 1 - inicio.getUTCMonth());
    return item.parcelaAtual + diffMeses;
  };

  const getEndDate = (item: DespesaVariavel): Date => {
    const inicio = new Date(item.dataInicio);
    const totalMonths = inicio.getUTCMonth() + (item.parcelasTotal - item.parcelaAtual);
    const endYear = inicio.getUTCFullYear() + Math.floor(totalMonths / 12);
    const endMonth = totalMonths % 12;
    return new Date(endYear, endMonth, 1);
  };

  const isActiveInMonth = (item: DespesaVariavel) => {
    const p = getParcelaForMonth(item);
    return p >= 1 && p <= item.parcelasTotal;
  };

  const isConfirmadaInMonth = (item: DespesaVariavel) =>
    confirmadaNoMes(item.dataInicio, item.confirmadaAte, mes, ano);

  const handleCreate = async (data: DespesaVariavelPayload) => {
    setSaving(true);
    const res = await fetch("/api/despesas-variaveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); toast("Despesa criada"); }
    else toast("Erro ao criar despesa", "error");
  };

  const handleEdit = async (data: DespesaVariavelPayload) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/despesas-variaveis/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); toast("Despesa atualizada"); }
    else toast("Erro ao atualizar despesa", "error");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa variável?")) return;
    const res = await fetch(`/api/despesas-variaveis/${id}`, { method: "DELETE" });
    if (res.ok) { fetchData(); toast("Despesa excluída"); }
    else toast("Erro ao excluir despesa", "error");
  };

  const handleConfirmar = async (item: DespesaVariavel) => {
    setLoadingActionId(item.id);
    const d = new Date(item.dataInicio);
    const novaData = format(addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1), "yyyy-MM-dd");
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    // Pagar = avança o vencimento E o ponteiro da próxima parcela não paga.
    // Assim a parcela quitada sai da projeção (não fica só empurrada pra frente).
    const res = await fetch(`/api/despesas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataInicio: novaData,
        confirmadaAte,
        parcelaAtual: item.parcelaAtual + 1,
      }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Pagamento confirmado"); }
    else toast("Erro ao confirmar pagamento", "error");
  };

  const handleConfirmarTodos = async (group: CardGroup) => {
    if (group.pendentes.length === 0) return;
    setLoadingActionId(`group-${group.cartao}`);
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    // Monta um único request atômico em vez de N PUTs paralelos (que pagavam parcialmente).
    const updates = group.pendentes.map(({ item }) => {
      const d = new Date(item.dataInicio);
      const novaData = format(addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1), "yyyy-MM-dd");
      return {
        id: item.id,
        dataInicio: novaData,
        confirmadaAte,
        parcelaAtual: item.parcelaAtual + 1,
      };
    });
    const res = await fetch(`/api/despesas-variaveis/lote`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setLoadingActionId(null);
    if (res.ok) {
      await fetchData();
      toast(`Cartão ${group.cartao} marcado como pago`);
    } else {
      toast(`Erro ao pagar cartão ${group.cartao}`, "error");
    }
  };

  const handleReverterVariavel = async (item: DespesaVariavel) => {
    setLoadingActionId(item.id);
    const d = new Date(item.dataInicio);
    const prevInicio = subMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
    // Desfazer = inverso do pagamento: volta o vencimento e o ponteiro da parcela.
    const res = await fetch(`/api/despesas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataInicio: format(prevInicio, "yyyy-MM-dd"),
        confirmadaAte: null,
        parcelaAtual: Math.max(1, item.parcelaAtual - 1),
      }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Pagamento desfeito"); }
    else toast("Erro ao desfazer pagamento", "error");
  };

  const openEdit = (item: DespesaVariavel) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? {
        descricao: selected.descricao,
        cartao: selected.cartao,
        categoria: selected.categoria ?? "Outros",
        valorParcela: selected.valorParcela,
        parcelasTotal: Math.max(selected.parcelasTotal - (selected.parcelaAtual - 1), 1),
        responsavel: selected.responsavel,
        dataInicio: selected.dataInicio.slice(0, 10),
      }
    : undefined;

  const toggleCard = (cartao: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cartao)) next.delete(cartao);
      else next.add(cartao);
      return next;
    });
  };

  const filtrados = filtro
    ? items.filter(
        (i) =>
          i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.cartao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.responsavel.toLowerCase().includes(filtro.toLowerCase())
      )
    : items;

  const ativas = filtrados.filter(isActiveInMonth);
  const confirmadasFora = filtrados.filter((i) => !isActiveInMonth(i) && isConfirmadaInMonth(i));
  const allVisible = [...ativas, ...confirmadasFora];

  const nowMes = now.getMonth() + 1;
  const nowAno = now.getFullYear();
  const concluidas = filtrados.filter((i) => {
    const inicio = new Date(i.dataInicio);
    const diffMeses = (nowAno - inicio.getUTCFullYear()) * 12 + (nowMes - 1 - inicio.getUTCMonth());
    return i.parcelaAtual + diffMeses > i.parcelasTotal;
  });

  const cardRestanteMap = new Map<string, number>();
  for (const item of filtrados) {
    // Restante = parcelas ainda não pagas (de parcelaAtual até parcelasTotal).
    if (item.parcelaAtual > item.parcelasTotal) continue; // concluída
    const remaining = (item.parcelasTotal - item.parcelaAtual + 1) * item.valorParcela;
    const cartao = item.cartao || "Sem cartão";
    cardRestanteMap.set(cartao, (cardRestanteMap.get(cartao) ?? 0) + remaining);
  }

  const cardGroupsMap = new Map<string, CardGroup>();
  for (const item of allVisible) {
    const cartao = item.cartao || "Sem cartão";
    if (!cardGroupsMap.has(cartao)) {
      cardGroupsMap.set(cartao, { cartao, pendentes: [], pagas: [], totalPendente: 0 });
    }
    const g = cardGroupsMap.get(cartao)!;
    const parcela = Math.max(1, Math.min(getParcelaForMonth(item), item.parcelasTotal));
    if (isConfirmadaInMonth(item)) {
      g.pagas.push({ item, parcela });
    } else {
      g.pendentes.push({ item, parcela });
      g.totalPendente += item.valorParcela;
    }
  }
  const cardGroups = Array.from(cardGroupsMap.values()).sort((a, b) => b.totalPendente - a.totalPendente);
  const totalPendente = cardGroups.reduce((s, g) => s + g.totalPendente, 0);

  const isEmpty = allVisible.length === 0 && concluidas.length === 0;

  return (
    <div className="max-w-3xl mx-auto">
      <Cabecalho
        titulo="Cartões e parcelas"
        subtitulo={
          loading ? undefined : (
            <>
              Falta pagar em {mesLabel}: <span className="valor font-medium text-tinta-900">{formatCurrency(totalPendente)}</span>
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
          Nova compra
        </button>
      </Cabecalho>

      {loading ? (
        <div className="space-y-3" aria-busy>
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-tinta-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Vazio texto="Nenhuma compra parcelada ainda." acao="Lançar a primeira" />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tinta-400" />
            <input
              type="search"
              placeholder="Buscar compra, cartão ou pessoa"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-superficie ring-1 ring-tinta-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-marca-500"
            />
          </div>

          {isEmpty ? (
            <p className="py-10 text-center text-sm text-tinta-500">Nenhuma parcela em {mesLabel}{filtro ? " com essa busca" : ""}.</p>
          ) : (
            <div className="space-y-3">
              {cardGroups.map((group) => {
                const expanded = expandedCards.has(group.cartao) || Boolean(filtro);
                const totalItens = group.pendentes.length + group.pagas.length;
                const isGroupLoading = loadingActionId === `group-${group.cartao}`;
                const restante = cardRestanteMap.get(group.cartao) ?? 0;
                return (
                  <section key={group.cartao} className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
                    <button
                      onClick={() => toggleCard(group.cartao)}
                      aria-expanded={expanded}
                      className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-tinta-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-tinta-900 truncate">{group.cartao}</p>
                        <p className="text-xs text-tinta-500 mt-0.5">
                          {totalItens} {totalItens === 1 ? "parcela" : "parcelas"} no mês
                          {group.pagas.length > 0 && `, ${group.pagas.length} paga${group.pagas.length > 1 ? "s" : ""}`}
                          {restante > 0 && `. Faltam ${formatCurrency(restante)} para quitar`}
                        </p>
                      </div>
                      <span className={cn("valor text-base font-semibold flex-shrink-0", group.totalPendente > 0 ? "text-tinta-900" : "text-tinta-400")}>
                        {formatCurrency(group.totalPendente)}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 text-tinta-400 flex-shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
                    </button>

                    {expanded && (
                      <div className="border-t border-tinta-100">
                        {isCurrentMonth && group.pendentes.length > 1 && (
                          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 bg-tinta-50">
                            <span className="text-xs text-tinta-500">Pagou a fatura inteira?</span>
                            <button
                              onClick={() => handleConfirmarTodos(group)}
                              disabled={loadingActionId !== null}
                              className="flex items-center gap-1.5 text-sm font-medium text-marca-700 hover:bg-marca-50 px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {isGroupLoading ? "Marcando…" : `Marcar as ${group.pendentes.length} como pagas`}
                            </button>
                          </div>
                        )}
                        <div className="divide-y divide-tinta-100">
                          {group.pendentes.map(({ item, parcela }) => (
                            <Linha
                              key={item.id}
                              titulo={item.descricao}
                              aoAbrir={() => openEdit(item)}
                              detalhe={`${parcela} de ${item.parcelasTotal}, até ${format(getEndDate(item), "MMM/yy", { locale: ptBR })}, ${item.responsavel}, vence ${formatDate(item.dataInicio).slice(0, 5)}`}
                              valor={formatCurrency(item.valorParcela)}
                              acoes={
                                <>
                                  {isCurrentMonth && (
                                    <BotaoIcone rotulo="Marcar como paga" onClick={() => handleConfirmar(item)} disabled={loadingActionId !== null}>
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
                          {group.pagas.map(({ item, parcela }) => (
                            <Linha
                              key={item.id}
                              apagada
                              titulo={item.descricao}
                              aoAbrir={() => openEdit(item)}
                              detalhe={`Paga, ${parcela} de ${item.parcelasTotal}, ${item.responsavel}`}
                              valor={formatCurrency(item.valorParcela)}
                              acoes={
                                <>
                                  <BotaoIcone rotulo="Desfazer pagamento" onClick={() => handleReverterVariavel(item)} disabled={loadingActionId !== null}>
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
                      </div>
                    )}
                  </section>
                );
              })}

              {concluidas.length > 0 && (
                <details className="group rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
                  <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 cursor-pointer list-none hover:bg-tinta-50">
                    <span className="text-sm text-tinta-600">Quitadas ({concluidas.length})</span>
                    <ChevronDown className="w-4 h-4 text-tinta-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="divide-y divide-tinta-100 border-t border-tinta-100">
                    {concluidas.map((item) => (
                      <Linha
                        key={item.id}
                        apagada
                        titulo={item.descricao}
                        aoAbrir={() => openEdit(item)}
                        detalhe={`${item.cartao}, ${item.parcelasTotal}x, ${item.responsavel}`}
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
        <Modal title="Nova compra parcelada" onClose={() => setModal(null)}>
          <DespesaVariavelForm onSubmit={handleCreate} loading={saving} cartoes={cartoesExistentes} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar compra parcelada" onClose={() => { setModal(null); setSelected(null); }}>
          <DespesaVariavelForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} cartoes={cartoesExistentes} />
          <BotaoExcluir onClick={() => { handleDelete(selected.id); setModal(null); setSelected(null); }} />
        </Modal>
      )}
    </div>
  );
}
