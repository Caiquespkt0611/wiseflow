"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().min(1, "Obrigatório"),
  cartao: z.string().min(1, "Obrigatório"),
  valorTotal: z.coerce.number().positive("Obrigatório"),
  parcelaAtual: z.coerce.number().int().min(1, "Obrigatório"),
  parcelasTotal: z.coerce.number().int().min(1, "Obrigatório"),
  valorParcela: z.coerce.number().positive("Obrigatório"),
  responsavel: z.string().min(1, "Obrigatório"),
  dataInicio: z.string().min(1, "Obrigatório"),
});

export type DespesaVariavelFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<DespesaVariavelFormData>;
  onSubmit: (data: DespesaVariavelFormData) => Promise<void>;
  loading?: boolean;
}

export function DespesaVariavelForm({ defaultValues, onSubmit, loading }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DespesaVariavelFormData>({
    resolver: zodResolver(schema) as Resolver<DespesaVariavelFormData>,
    defaultValues: { parcelaAtual: 1, ...defaultValues },
  });

  const valorTotal = watch("valorTotal");
  const parcelasTotal = watch("parcelasTotal");

  const calcParcela = () => {
    if (valorTotal && parcelasTotal) {
      setValue("valorParcela", Number((valorTotal / parcelasTotal).toFixed(2)));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Descrição" error={errors.descricao?.message}>
        <input {...register("descricao")} className={inputClass} placeholder="Ex: iPhone 16" />
      </Field>

      <Field label="Cartão" error={errors.cartao?.message}>
        <input {...register("cartao")} className={inputClass} placeholder="Ex: Nubank, Inter..." />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor Total (R$)" error={errors.valorTotal?.message}>
          <input
            {...register("valorTotal")}
            type="number"
            step="0.01"
            className={inputClass}
            placeholder="0,00"
            onBlur={calcParcela}
          />
        </Field>
        <Field label="Valor Parcela (R$)" error={errors.valorParcela?.message}>
          <input {...register("valorParcela")} type="number" step="0.01" className={inputClass} placeholder="0,00" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Parcela Atual" error={errors.parcelaAtual?.message}>
          <input {...register("parcelaAtual")} type="number" min="1" className={inputClass} />
        </Field>
        <Field label="Total Parcelas" error={errors.parcelasTotal?.message}>
          <input {...register("parcelasTotal")} type="number" min="1" className={inputClass} onBlur={calcParcela} />
        </Field>
        <Field label="Data Início" error={errors.dataInicio?.message}>
          <input {...register("dataInicio")} type="date" className={inputClass} />
        </Field>
      </div>

      <Field label="Responsável" error={errors.responsavel?.message}>
        <input {...register("responsavel")} className={inputClass} placeholder="Nome do responsável" />
      </Field>

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
