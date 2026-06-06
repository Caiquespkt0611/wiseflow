"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle2, Search } from "lucide-react";
import { format, addMonths } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { DespesaFixaForm, DespesaFixaFormData } from "@/components/forms/DespesaFixaForm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SortTh, nextSort, sortList, type SortState } from "@/components/ui/SortTh";

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/despesas-fixas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: DespesaFixaFormData) => {
    setSaving(true);
    const res = await fetch("/api/despesas-fixas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
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
    if (res.ok) { setModal(null); setSelected(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta despesa fixa?")) return;
    await fetch(`/api/despesas-fixas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleConfirmar = async (item: DespesaFixa) => {
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
    await fetch(`/api/despesas-fixas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataProximoVencimento: format(proximo, "yyyy-MM-dd") }),
    });
    fetchData();
  };

  const openEdit = (item: DespesaFixa) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? { ...selected, dataInicio: format(new Date(selected.dataInicio), "yyyy-MM-dd") }
    : undefined;

  const now = new Date();

  const isPaga = (item: DespesaFixa) => {
    if (!item.dataProximoVencimento) return false;
    const v = new Date(item.dataProximoVencimento);
    return (
      v.getUTCFullYear() > now.getFullYear() ||
      (v.getUTCFullYear() === now.getFullYear() && v.getUTCMonth() > now.getMonth())
    );
  };

  const sorters: Partial<Record<string, (i: DespesaFixa) => string | number>> = {
    descricao: (i) => i.descricao.toLowerCase(),
    responsavel: (i) => i.responsavel.toLowerCase(),
    dataInicio: (i) => i.dataInicio,
    valor: (i) => i.valor,
  };

  const ativas = sortList(
    items.filter((i) => i.ativa).filter(
      (i) =>
        !filtro ||
        i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
        i.responsavel.toLowerCase().includes(filtro.toLowerCase())
    ),
    sort,
    sorters
  );
  const pendentes = ativas.filter((i) => !isPaga(i));
  const pagas = ativas.filter((i) => isPaga(i));

  const totalPendentes = pendentes.reduce((sum, i) => sum + i.valor, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas Fixas</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              Pendente este mês: <span className="font-medium text-red-600">{formatCurrency(totalPendentes)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa Fixa
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.filter((i) => i.ativa).length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma despesa fixa cadastrada</div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou responsável..."
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
                  <SortTh label="Responsável" col="responsavel" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <SortTh label="Início" col="dataInicio" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <SortTh label="Valor/mês" col="valor" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendentes.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">{formatCurrency(item.valor)}</td>
                    <td className="px-4 py-3">
                      {item.recorrente && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          <RefreshCw className="w-3 h-3" /> Recorrente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleConfirmar(item)}
                          title="Confirmar pagamento"
                          className="p-1.5 hover:bg-emerald-50 rounded-lg group"
                        >
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
                ))}

                {pagas.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                        Pagas este mês
                      </td>
                    </tr>
                    {pagas.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 opacity-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 line-through">{item.descricao}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-400">{formatCurrency(item.valor)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Paga</span>
                        </td>
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
        <Modal title="Nova Despesa Fixa" onClose={() => setModal(null)}>
          <DespesaFixaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Despesa Fixa" onClose={() => { setModal(null); setSelected(null); }}>
          <DespesaFixaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
