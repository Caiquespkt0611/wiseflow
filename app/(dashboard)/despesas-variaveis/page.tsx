"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Search, ChevronDown, ChevronRight as ChevronRightIcon, CreditCard, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { DespesaVariavelForm, DespesaVariavelPayload } from "@/components/forms/DespesaVariavelForm";
import { formatCurrency, formatDate } from "@/lib/utils";

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

  const getParcelaForMonth = (item: DespesaVariavel) => {
    const inicio = new Date(item.dataInicio);
    const diffMeses = (ano - inicio.getUTCFullYear()) * 12 + (mes - 1 - inicio.getUTCMonth());
    return item.parcelaAtual + diffMeses;
  };

  const getEndDate = (item: DespesaVariavel): Date => {
    const inicio = new Date(item.dataInicio);
    const monthsToEnd = item.parcelasTotal - item.parcelaAtual;
    return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + monthsToEnd, 1));
  };

  const isActiveInMonth = (item: DespesaVariavel) => {
    const p = getParcelaForMonth(item);
    return p >= 1 && p <= item.parcelasTotal;
  };

  const isConfirmadaInMonth = (item: DespesaVariavel) => {
    if (!item.confirmadaAte) return false;
    const c = new Date(item.confirmadaAte);
    return c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes;
  };

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
    const parcelaAtualCalc = getParcelaForMonth(item);
    const isLast = parcelaAtualCalc >= item.parcelasTotal;
    const res = await fetch(`/api/despesas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataInicio: novaData,
        confirmadaAte,
        ...(isLast && { parcelaAtual: item.parcelasTotal + 1 }),
      }),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Pagamento confirmado"); }
    else toast("Erro ao confirmar pagamento", "error");
  };

  const handleReverterVariavel = async (item: DespesaVariavel) => {
    setLoadingActionId(item.id);
    const d = new Date(item.dataInicio);
    const prevInicio = subMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
    const wasLast = item.parcelaAtual > item.parcelasTotal;
    const body: Record<string, unknown> = {
      dataInicio: format(prevInicio, "yyyy-MM-dd"),
      confirmadaAte: null,
    };
    if (wasLast) {
      const oldDiffMeses = (ano - prevInicio.getUTCFullYear()) * 12 + (mes - 1 - prevInicio.getUTCMonth());
      body.parcelaAtual = item.parcelasTotal - oldDiffMeses;
    }
    const res = await fetch(`/api/despesas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  // Filter by search
  const filtrados = filtro
    ? items.filter(
        (i) =>
          i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.cartao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.responsavel.toLowerCase().includes(filtro.toLowerCase())
      )
    : items;

  // Items active in selected month
  const ativas = filtrados.filter(isActiveInMonth);
  // Items confirmed this month but data was advanced (no longer active in this month via filter)
  const confirmadasFora = filtrados.filter((i) => !isActiveInMonth(i) && isConfirmadaInMonth(i));
  const allVisible = [...ativas, ...confirmadasFora];

  // Concluídas: all installments done as of today
  const nowMes = now.getMonth() + 1;
  const nowAno = now.getFullYear();
  const concluidas = filtrados.filter((i) => {
    const inicio = new Date(i.dataInicio);
    const diffMeses = (nowAno - inicio.getUTCFullYear()) * 12 + (nowMes - 1 - inicio.getUTCMonth());
    return i.parcelaAtual + diffMeses > i.parcelasTotal;
  });

  // Group visible items by cartão
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
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas Variáveis</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              Pendente em {mesLabel}:{" "}
              <span className="font-medium text-orange-600">{formatCurrency(totalPendente)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthSelector date={date} onChange={setDate} />
          <button
            onClick={() => setModal("create")}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Despesa
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma despesa variável cadastrada</div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, cartão ou responsável..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {isEmpty ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhuma despesa variável em {mesLabel}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {cardGroups.map((group) => {
                  const expanded = expandedCards.has(group.cartao);
                  const totalItens = group.pendentes.length + group.pagas.length;
                  return (
                    <div key={group.cartao}>
                      {/* Card group header */}
                      <button
                        onClick={() => toggleCard(group.cartao)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-shrink-0 w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 flex-1">{group.cartao}</span>
                        <span className="text-xs text-gray-400 mr-2">
                          {totalItens} {totalItens === 1 ? "item" : "itens"}
                        </span>
                        {group.pagas.length > 0 && (
                          <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full mr-2">
                            {group.pagas.length} pago{group.pagas.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className={`text-sm font-bold mr-2 ${group.totalPendente > 0 ? "text-orange-600" : "text-gray-400"}`}>
                          {formatCurrency(group.totalPendente)}
                        </span>
                        {expanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Expanded items */}
                      {expanded && (
                        <div className="bg-gray-50/50">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide pl-14">Descrição</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Responsável</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Parcelas</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Valor</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Vencimento</th>
                                <th className="px-4 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.pendentes.map(({ item, parcela }) => (
                                <tr key={item.id} className="hover:bg-white transition-colors">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 pl-14">{item.descricao}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">{parcela}/{item.parcelasTotal}</span>
                                        <div className="w-14 bg-gray-200 rounded-full h-1.5">
                                          <div
                                            className="bg-orange-400 rounded-full h-1.5"
                                            style={{ width: `${(parcela / item.parcelasTotal) * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                      <span className="text-xs text-gray-400">
                                        até {format(getEndDate(item), "MMM/yy", { locale: ptBR })}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-orange-600">{formatCurrency(item.valorParcela)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      {isCurrentMonth && (
                                        <button
                                          onClick={() => handleConfirmar(item)}
                                          disabled={loadingActionId === item.id}
                                          title="Confirmar pagamento"
                                          className="p-1.5 hover:bg-emerald-50 rounded-lg group disabled:opacity-40"
                                        >
                                          <CheckCircle2 className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                        </button>
                                      )}
                                      <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                        <Pencil className="w-4 h-4 text-gray-500" />
                                      </button>
                                      <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}

                              {group.pagas.map(({ item, parcela }) => (
                                <tr key={item.id} className="opacity-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-700 line-through pl-14">{item.descricao}</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{item.responsavel}</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{parcela}/{item.parcelasTotal}</td>
                                  <td className="px-4 py-3 text-sm text-gray-400">{formatCurrency(item.valorParcela)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(item.dataInicio)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Pago</span>
                                      <button
                                        onClick={() => handleReverterVariavel(item)}
                                        disabled={loadingActionId === item.id}
                                        title="Desfazer pagamento"
                                        className="p-1.5 hover:bg-orange-50 rounded-lg group disabled:opacity-40"
                                      >
                                        <RotateCcw className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" />
                                      </button>
                                      <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                        <Pencil className="w-4 h-4 text-gray-400" />
                                      </button>
                                      <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-4 h-4 text-red-300" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Concluídas (always visible, management section) */}
                {concluidas.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                      Concluídas
                    </div>
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-50">
                        {concluidas.map((item) => (
                          <tr key={item.id} className="opacity-40">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 line-through">{item.descricao}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.cartao}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.responsavel}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.parcelasTotal}/{item.parcelasTotal}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{formatCurrency(item.valorParcela)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4 text-red-300" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modal === "create" && (
        <Modal title="Nova Despesa Variável" onClose={() => setModal(null)}>
          <DespesaVariavelForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Despesa Variável" onClose={() => { setModal(null); setSelected(null); }}>
          <DespesaVariavelForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
