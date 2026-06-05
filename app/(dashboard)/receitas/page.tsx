"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { ReceitaForm, ReceitaFormData } from "@/components/forms/ReceitaForm";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Receita {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  responsavel: string;
  recorrente: boolean;
  ativa: boolean;
}

export default function ReceitasPage() {
  const [items, setItems] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Receita | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/receitas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: ReceitaFormData) => {
    setSaving(true);
    const res = await fetch("/api/receitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
  };

  const handleEdit = async (data: ReceitaFormData) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/receitas/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const openEdit = (item: Receita) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? { ...selected, data: format(new Date(selected.data), "yyyy-MM-dd") }
    : undefined;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma receita cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Descrição", "Tipo", "Responsável", "Data", "Valor", "Status", ""].map((h) => (
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
                    <td className="px-4 py-3 text-sm text-gray-600">{item.tipo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.data)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                      {formatCurrency(item.valor)}
                    </td>
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
        <Modal title="Nova Receita" onClose={() => setModal(null)}>
          <ReceitaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Receita" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
