"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Search } from "lucide-react";
import { format, addMonths } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { DespesaVariavelForm, DespesaVariavelPayload } from "@/components/forms/DespesaVariavelForm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SortTh, nextSort, sortList, type SortState } from "@/components/ui/SortTh";

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

export default function DespesasVariaveisPage() {
  const [items, setItems] = useState<DespesaVariavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DespesaVariavel | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/despesas-variaveis");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: DespesaVariavelPayload) => {
    setSaving(true);
    const res = await fetch("/api/despesas-variaveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
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
    if (res.ok) { setModal(null); setSelected(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa variável?")) return;
    await fetch(`/api/despesas-variaveis/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleConfirmar = async (item: DespesaVariavel) => {
    const d = new Date(item.dataInicio);
    const novaData = format(addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1), "yyyy-MM-dd");
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    const isLast = getParcelaAtual(item) >= item.parcelasTotal;
    await fetch(`/api/despesas-variaveis/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataInicio: novaData,
        confirmadaAte,
        ...(isLast && { parcelaAtual: item.parcelasTotal + 1 }),
      }),
    });
    fetchData();
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
        // parcelas restantes a partir de hoje
        parcelasTotal: Math.max(selected.parcelasTotal - (selected.parcelaAtual - 1), 1),
        responsavel: selected.responsavel,
        dataInicio: selected.dataInicio.slice(0, 10),
      }
    : undefined;

  const now = new Date();
  const getParcelaAtual = (item: DespesaVariavel) => {
    const inicio = new Date(item.dataInicio);
    const diffMeses =
      (now.getFullYear() - inicio.getFullYear()) * 12 + now.getMonth() - inicio.getMonth();
    return item.parcelaAtual + diffMeses;
  };

  const sorters: Partial<Record<string, (i: DespesaVariavel) => string | number>> = {
    descricao: (i) => i.descricao.toLowerCase(),
    cartao: (i) => i.cartao.toLowerCase(),
    responsavel: (i) => i.responsavel.toLowerCase(),
    valorParcela: (i) => i.valorParcela,
    dataInicio: (i) => i.dataInicio,
  };

  const itensFiltrados = sortList(
    filtro
      ? items.filter(
          (i) =>
            i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
            i.cartao.toLowerCase().includes(filtro.toLowerCase()) ||
            i.responsavel.toLowerCase().includes(filtro.toLowerCase())
        )
      : items,
    sort,
    sorters
  );

  const ativas = itensFiltrados.filter((item) => getParcelaAtual(item) <= item.parcelasTotal);
  const concluidas = itensFiltrados.filter((item) => getParcelaAtual(item) > item.parcelasTotal);
  const totalMensal = ativas.reduce((sum, i) => sum + i.valorParcela, 0);

  // Paga este mês = confirmação explícita ocorreu neste mês/ano
  const isConfirmada = (item: DespesaVariavel) => {
    if (!item.confirmadaAte) return false;
    const c = new Date(item.confirmadaAte);
    return c.getUTCFullYear() === now.getFullYear() && c.getUTCMonth() === now.getMonth();
  };

  const pendentes = ativas.filter((i) => !isConfirmada(i));
  const pagas = ativas.filter((i) => isConfirmada(i));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas Variáveis</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              Pendente este mês: <span className="font-medium text-orange-600">{formatCurrency(totalMensal)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa
        </button>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortTh label="Descrição" col="descricao" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <SortTh label="Cartão" col="cartao" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <SortTh label="Responsável" col="responsavel" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Parcelas</th>
                  <SortTh label="Valor Parcela" col="valorParcela" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <SortTh label="Próximo Vencimento" col="dataInicio" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendentes.map((item) => {
                  const parcelaAtualCalc = Math.max(1, Math.min(getParcelaAtual(item), item.parcelasTotal));
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.cartao}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {parcelaAtualCalc}/{item.parcelasTotal}
                          </span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-orange-400 rounded-full h-1.5" style={{ width: `${(parcelaAtualCalc / item.parcelasTotal) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-orange-600">{formatCurrency(item.valorParcela)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleConfirmar(item)} title="Confirmar pagamento desta parcela" className="p-1.5 hover:bg-emerald-50 rounded-lg group">
                            <CheckCircle2 className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                          </button>
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

                {pagas.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={7} className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                        Parcelas pagas este mês
                      </td>
                    </tr>
                    {pagas.map((item) => {
                      const parcelaAtualCalc = Math.max(1, Math.min(getParcelaAtual(item), item.parcelasTotal));
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 opacity-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 line-through">{item.descricao}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.cartao}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-500">{parcelaAtualCalc}/{item.parcelasTotal}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{formatCurrency(item.valorParcela)}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{formatDate(item.dataInicio)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
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
                        <td className="px-4 py-3 text-sm text-gray-500">{item.cartao}</td>
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
