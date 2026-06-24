"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Search, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { ReceitaVariavelForm, ReceitaVariavelPayload } from "@/components/forms/ReceitaVariavelForm";
import { SortTh, nextSort, sortList, type SortState } from "@/components/ui/SortTh";
import { formatCurrency, formatDate } from "@/lib/utils";

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

  const getParcelaForMonth = (item: ReceitaVariavel) => {
    const inicio = new Date(item.dataInicio);
    const diffMeses = (ano - inicio.getUTCFullYear()) * 12 + (mes - 1 - inicio.getUTCMonth());
    return item.parcelaAtual + diffMeses;
  };

  const isActiveInMonth = (item: ReceitaVariavel) => {
    const p = getParcelaForMonth(item);
    return p >= 1 && p <= item.parcelasTotal;
  };

  const isConfirmadaInMonth = (item: ReceitaVariavel) => {
    if (!item.confirmadaAte) return false;
    const c = new Date(item.confirmadaAte);
    return c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes;
  };

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas Variáveis</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              A receber em {mesLabel}:{" "}
              <span className="font-medium text-emerald-600">{formatCurrency(totalMensal)}</span>
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
            Nova Receita
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma receita variável cadastrada</div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, fonte ou responsável..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {isEmpty && concluidas.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhuma receita variável em {mesLabel}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <SortTh label="Descrição" col="descricao" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Fonte" col="fonte" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Responsável" col="responsavel" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Parcelas</th>
                      <SortTh label="Valor Parcela" col="valorParcela" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Próximo Recebimento" col="dataInicio" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendentes.map((item) => {
                      const parcelaAtualCalc = Math.max(1, Math.min(getParcelaForMonth(item), item.parcelasTotal));
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.fonte}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{parcelaAtualCalc}/{item.parcelasTotal}</span>
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className="bg-emerald-400 rounded-full h-1.5" style={{ width: `${(parcelaAtualCalc / item.parcelasTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-emerald-600">{formatCurrency(item.valorParcela)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {isCurrentMonth && (
                                <button onClick={() => handleConfirmar(item)} disabled={loadingActionId === item.id} title="Confirmar recebimento" className="p-1.5 hover:bg-emerald-50 rounded-lg group disabled:opacity-40">
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
                      );
                    })}

                    {recebidas.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={7} className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                            Recebidas em {mesLabel}
                          </td>
                        </tr>
                        {recebidas.map((item) => {
                          const parcelaAtualCalc = Math.max(1, Math.min(getParcelaForMonth(item), item.parcelasTotal));
                          return (
                            <tr key={item.id} className="hover:bg-gray-50 opacity-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 line-through">{item.descricao}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.fonte}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-500">{parcelaAtualCalc}/{item.parcelasTotal}</td>
                              <td className="px-4 py-3 text-sm text-gray-400">{formatCurrency(item.valorParcela)}</td>
                              <td className="px-4 py-3 text-sm text-gray-400">{formatDate(item.dataInicio)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleReverterReceitaVar(item)}
                                    disabled={loadingActionId === item.id}
                                    title="Desfazer recebimento"
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
                          );
                        })}
                      </>
                    )}

                    {concluidas.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={7} className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                            Concluídas
                          </td>
                        </tr>
                        {concluidas.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 opacity-40">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 line-through">{item.descricao}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.fonte}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.responsavel}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.parcelasTotal}/{item.parcelasTotal}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{formatCurrency(item.valorParcela)}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{formatDate(item.dataInicio)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4 text-red-300" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modal === "create" && (
        <Modal title="Nova Receita Variável" onClose={() => setModal(null)}>
          <ReceitaVariavelForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Receita Variável" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaVariavelForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
