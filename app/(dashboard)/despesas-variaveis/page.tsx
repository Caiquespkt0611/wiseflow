"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { DespesaVariavelForm, DespesaVariavelFormData } from "@/components/forms/DespesaVariavelForm";
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
  dataInicio: string;
}

export default function DespesasVariaveisPage() {
  const [items, setItems] = useState<DespesaVariavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<DespesaVariavel | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/despesas-variaveis");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: DespesaVariavelFormData) => {
    setSaving(true);
    const res = await fetch("/api/despesas-variaveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
  };

  const handleEdit = async (data: DespesaVariavelFormData) => {
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

  const openEdit = (item: DespesaVariavel) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? { ...selected, dataInicio: format(new Date(selected.dataInicio), "yyyy-MM-dd") }
    : undefined;

  const parcelasAtivas = items.filter((item) => {
    const inicio = new Date(item.dataInicio);
    const now = new Date();
    const diffMeses = (now.getFullYear() - inicio.getFullYear()) * 12 + now.getMonth() - inicio.getMonth();
    const parcelaAtualCalc = item.parcelaAtual + diffMeses;
    return parcelaAtualCalc <= item.parcelasTotal;
  });

  const totalMensal = parcelasAtivas.reduce((sum, i) => sum + i.valorParcela, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas Variáveis</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-1">
              Total este mês: <span className="font-medium text-orange-600">{formatCurrency(totalMensal)}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Descrição", "Cartão", "Responsável", "Parcelas", "Valor Parcela", "Valor Total", "Início", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => {
                  const inicio = new Date(item.dataInicio);
                  const now = new Date();
                  const diffMeses = (now.getFullYear() - inicio.getFullYear()) * 12 + now.getMonth() - inicio.getMonth();
                  const parcelaAtualCalc = Math.min(item.parcelaAtual + diffMeses, item.parcelasTotal);
                  const concluido = parcelaAtualCalc >= item.parcelasTotal;

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${concluido ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.cartao}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {parcelaAtualCalc}/{item.parcelasTotal}
                          </span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-orange-400 rounded-full h-1.5"
                              style={{ width: `${(parcelaAtualCalc / item.parcelasTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-orange-600">
                        {formatCurrency(item.valorParcela)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(item.valorTotal)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.dataInicio)}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
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
