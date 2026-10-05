"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { BotaoIcone, BotaoExcluir } from "@/components/ui/Linha";
import { useAoLancar } from "@/lib/eventos";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ContaBancaria {
  id: string;
  nome: string;
  saldo: number;
  updatedAt: string;
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
        <label className="campo-rotulo">Nome da conta</label>
        <input
          {...register("nome")}
          className="campo"
          placeholder="Ex: Mercado Pago Caique"
        />
        {errors.nome && <p className="text-saida-500 text-xs mt-1">{errors.nome.message}</p>}
      </div>
      <div>
        <label className="campo-rotulo">Saldo atual (R$)</label>
        <input
          {...register("saldo", { valueAsNumber: true })}
          type="number"
          step="0.01"
          className="campo"
          placeholder="0,00"
        />
        {errors.saldo && <p className="text-saida-500 text-xs mt-1">{errors.saldo.message}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-marca hover:bg-marca-forte disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
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
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  const handleCreate = async (data: FormData) => {
    setSaving(true);
    const res = await fetch("/api/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); toast("Conta criada"); }
    else toast("Erro ao criar conta", "error");
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
    if (res.ok) { setModal(null); setSelected(null); fetchData(); toast("Conta atualizada"); }
    else toast("Erro ao atualizar conta", "error");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    const res = await fetch(`/api/contas/${id}`, { method: "DELETE" });
    if (res.ok) { fetchData(); toast("Conta excluída"); }
    else toast("Erro ao excluir conta", "error");
  };

  const openEdit = (item: ContaBancaria) => {
    setSelected(item);
    setModal("edit");
  };

  const totalSaldo = items.reduce((sum, c) => sum + c.saldo, 0);
  const oldestUpdate = items.length > 0
    ? items.reduce((oldest, c) => new Date(c.updatedAt) < new Date(oldest.updatedAt) ? c : oldest)
    : null;

  /** Saldo é o que mais muda aqui: edita direto na linha, Enter grava, Esc desiste. */
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  const comecarEdicao = (item: ContaBancaria) => {
    setEditando(item.id);
    setRascunho(String(item.saldo));
  };

  const gravarSaldo = async (item: ContaBancaria) => {
    const saldo = parseFloat(rascunho.replace(",", "."));
    setEditando(null);
    if (Number.isNaN(saldo) || saldo === item.saldo) return;
    setItems((lista) => lista.map((c) => (c.id === item.id ? { ...c, saldo, updatedAt: new Date().toISOString() } : c)));
    const res = await fetch(`/api/contas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saldo }),
    });
    if (res.ok) toast(`${item.nome} atualizado`);
    else { toast("Não consegui gravar o saldo", "error"); fetchData(); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Cabecalho titulo="Saldos das contas" subtitulo="O ponto de partida do painel e da projeção. Toque no valor para atualizar.">
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-marca hover:bg-marca-forte text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova conta
        </button>
      </Cabecalho>

      {loading ? (
        <div className="space-y-3" aria-busy>
          <div className="h-28 rounded-2xl bg-tinta-100 animate-pulse" />
          <div className="h-48 rounded-2xl bg-tinta-100 animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-tinta-300 px-6 py-12 text-center">
          <p className="text-sm text-tinta-600">Cadastre as contas e o dinheiro em mãos para o painel saber de onde partir.</p>
          <button onClick={() => setModal("create")} className="mt-3 text-sm font-medium text-marca-700 hover:underline underline-offset-4">
            Cadastrar a primeira
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 px-5 py-5 mb-3">
            <p className="text-sm text-tinta-600">Total em contas</p>
            <p className={cn("valor text-[34px] leading-tight font-semibold tracking-tight mt-1", totalSaldo >= 0 ? "text-tinta-900" : "text-saida-600")}>
              {formatCurrency(totalSaldo)}
            </p>
            {oldestUpdate && (
              <p className="text-xs text-tinta-500 mt-1">
                A conta mais antiga foi atualizada em {format(new Date(oldestUpdate.updatedAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })} ({oldestUpdate.nome})
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[60px]">
                <button onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left">
                  <p className="text-[15px] text-tinta-900 truncate">{item.nome}</p>
                  <p className="text-xs text-tinta-500 mt-0.5">
                    Atualizado {format(new Date(item.updatedAt), "d/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </button>
                {editando === item.id ? (
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                    onBlur={() => gravarSaldo(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") gravarSaldo(item);
                      if (e.key === "Escape") setEditando(null);
                    }}
                    aria-label={`Saldo de ${item.nome}`}
                    className="valor w-36 text-right text-[15px] font-medium bg-superficie border border-marca-500 ring-2 ring-marca-500/20 rounded-lg px-2.5 py-1.5 text-tinta-900 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => comecarEdicao(item)}
                    aria-label={`Atualizar saldo de ${item.nome}`}
                    className={cn(
                      "valor text-[15px] font-medium rounded-lg px-2.5 py-1.5 -mr-1 hover:bg-tinta-100 transition-colors",
                      item.saldo >= 0 ? "text-tinta-900" : "text-saida-600"
                    )}
                  >
                    {formatCurrency(item.saldo)}
                  </button>
                )}
                <BotaoIcone rotulo="Excluir" perigo soComputador onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-4 h-4" />
                </BotaoIcone>
              </div>
            ))}
          </section>
        </>
      )}

      {modal === "create" && (
        <Modal title="Nova conta" onClose={() => setModal(null)}>
          <ContaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar conta" onClose={() => { setModal(null); setSelected(null); }}>
          <ContaForm defaultValues={selected} onSubmit={handleEdit} loading={saving} />
          <BotaoExcluir onClick={() => { handleDelete(selected.id); setModal(null); setSelected(null); }} />
        </Modal>
      )}
    </div>
  );
}
