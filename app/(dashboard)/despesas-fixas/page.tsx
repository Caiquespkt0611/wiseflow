"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { DespesaFixaForm, DespesaFixaFormData } from "@/components/forms/DespesaFixaForm";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DespesaFixa {
  id: string;
  descricao: string;
  valor: number;
  responsavel: string;
  recorrente: boolean;
  ativa: boolean;
  dataInicio: string;
}

export default function DespesasFixasPage() {
  const [items, setItems] = useState<DespesaFixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DespesaFixa | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openEdit = (item: DespesaFixa) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? { ...selected, dataInicio: format(new Date(selected.dataInicio), "yyyy-MM-dd") }
    : undefined;

  const totalAtivas = items.filter((i) => i.ativa).reduce((sum, i) => sum + i.valor, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas Fixas</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              Total ativo: <span className="font-medium text-red-600">{formatCurrency(totalAtivas)}/mês</span>
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
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma despesa fixa cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Descrição", "Responsável", "Início", "Valor/mês", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">{formatCurrency(item.valor)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.recorrente && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            <RefreshCw className="w-3 h-3" /> Recorrente
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.ativa ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                          {item.ativa ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
              </tbody>
            </table>
          </div>
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
