"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CATEGORIAS } from "@/lib/categories";

const schema = z.object({
  descricao: z.string().min(1, "Obrigatório"),
  cartao: z.string().min(1, "Obrigatório"),
  categoria: z.string().min(1, "Obrigatório"),
  parcelasTotal: z.coerce.number().int().min(1, "Obrigatório"),
  valorParcela: z.coerce.number().positive("Obrigatório"),
  responsavel: z.string().min(1, "Obrigatório"),
  dataInicio: z.string().min(1, "Obrigatório"),
});

export type DespesaVariavelFormData = z.infer<typeof schema>;

export type DespesaVariavelPayload = DespesaVariavelFormData & {
  parcelaAtual: number;
  valorTotal: number;
};

interface Props {
  defaultValues?: Partial<DespesaVariavelFormData>;
  onSubmit: (data: DespesaVariavelPayload) => Promise<void>;
  loading?: boolean;
}

export function DespesaVariavelForm({ defaultValues, onSubmit, loading }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DespesaVariavelFormData>({
    resolver: zodResolver(schema) as Resolver<DespesaVariavelFormData>,
    defaultValues: { categoria: "Outros", ...defaultValues },
  });

  const handleFormSubmit = (data: DespesaVariavelFormData) => {
    return onSubmit({
      ...data,
      parcelaAtual: 1,
      valorTotal: data.valorParcela * data.parcelasTotal,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Field label="Descrição" error={errors.descricao?.message}>
        <input {...register("descricao")} className={inputClass} placeholder="Ex: iPhone 16" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cartão" error={errors.cartao?.message}>
          <input {...register("cartao")} className={inputClass} placeholder="Ex: Nubank, Inter..." />
        </Field>
        <Field label="Categoria" error={errors.categoria?.message}>
          <select {...register("categoria")} className={inputClass}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor da parcela (R$)" error={errors.valorParcela?.message}>
          <input {...register("valorParcela")} type="number" step="0.01" className={inputClass} placeholder="0,00" />
        </Field>
        <Field label="Parcelas restantes" error={errors.parcelasTotal?.message}>
          <input {...register("parcelasTotal")} type="number" min="1" className={inputClass} placeholder="Ex: 10" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Próximo vencimento" error={errors.dataInicio?.message}>
          <input {...register("dataInicio")} type="date" className={inputClass} />
        </Field>
        <Field label="Responsável" error={errors.responsavel?.message}>
          <input {...register("responsavel")} className={inputClass} placeholder="Nome do responsável" />
        </Field>
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
