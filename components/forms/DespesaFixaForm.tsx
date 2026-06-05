"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().min(1, "Obrigatório"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  responsavel: z.string().min(1, "Obrigatório"),
  recorrente: z.boolean(),
  ativa: z.boolean(),
  dataInicio: z.string().min(1, "Obrigatório"),
});

export type DespesaFixaFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<DespesaFixaFormData>;
  onSubmit: (data: DespesaFixaFormData) => Promise<void>;
  loading?: boolean;
}

export function DespesaFixaForm({ defaultValues, onSubmit, loading }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DespesaFixaFormData>({
    resolver: zodResolver(schema) as Resolver<DespesaFixaFormData>,
    defaultValues: { ativa: true, recorrente: true, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Descrição" error={errors.descricao?.message}>
        <input {...register("descricao")} className={inputClass} placeholder="Ex: Aluguel" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor (R$)" error={errors.valor?.message}>
          <input {...register("valor")} type="number" step="0.01" className={inputClass} placeholder="0,00" />
        </Field>
        <Field label="Data Início" error={errors.dataInicio?.message}>
          <input {...register("dataInicio")} type="date" className={inputClass} />
        </Field>
      </div>

      <Field label="Responsável" error={errors.responsavel?.message}>
        <input {...register("responsavel")} className={inputClass} placeholder="Nome do responsável" />
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input {...register("recorrente")} type="checkbox" className="rounded" />
          Recorrente (mensal)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input {...register("ativa")} type="checkbox" className="rounded" />
          Ativa
        </label>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
