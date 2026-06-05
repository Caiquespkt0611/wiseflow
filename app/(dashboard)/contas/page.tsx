"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ContaBancaria {
  id: string;
  nome: string;
  saldo: number;
}

const schema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  saldo: z.number(),
});

type FormData = z.infer<typeof schema>;

function ContaForm({
  defaultValues,
  onSubmit,
  loading,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  loading: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { saldo: 0 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da conta</label>
        <input
          {...register("nome")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Ex: Mercado Pago Caique"
        />
        {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Saldo atual (R$)</label>
        <input
          {...register("saldo", { valueAsNumber: true })}
          type="number"
          step="0.01"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="0,00"
        />
        {errors.saldo && <p className="text-red-500 text-xs mt-1">{errors.saldo.message}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

export default function ContasPage() {
  const [items, setItems] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<ContaBancaria | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: FormData) => {
    setSaving(true);
    const res = await fetch("/api/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
  };

  const handleEdit = async (data: FormData) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/contas/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    await fetch(`/api/contas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const openEdit = (item: ContaBancaria) => {
    setSelected(item);
    setModal("edit");
  };

  const totalSaldo = items.reduce((sum, c) => sum + c.saldo, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas Bancárias</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lançamento manual de saldos</p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
      </div>

      {items.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2.5 rounded-xl">
              <Landmark className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Saldo total em contas</span>
          </div>
          <span className={`text-xl font-bold ${totalSaldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(totalSaldo)}
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-100 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Nenhuma conta cadastrada</p>
            <p className="text-gray-400 text-sm mt-1">Adicione suas contas para acompanhar o saldo</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-xl">
                    <Landmark className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="font-medium text-gray-900">{item.nome}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-base font-bold ${item.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(item.saldo)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === "create" && (
        <Modal title="Nova Conta" onClose={() => setModal(null)}>
          <ContaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Conta" onClose={() => { setModal(null); setSelected(null); }}>
          <ContaForm defaultValues={selected} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}
    </div>
  );
}
