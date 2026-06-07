"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";

const schema = z.object({
  descricao: z.string().min(1, "Obrigatório"),
  tipo: z.string().min(1, "Obrigatório"),
  valor: z.coerce.number().refine((v) => v !== 0, "Valor não pode ser zero"),
  data: z.string().min(1, "Obrigatório"),
  responsavel: z.string().min(1, "Obrigatório"),
  recorrencia: z.enum(["unica", "recorrente", "parcelada"]),
  mesesTotal: z.coerce.number().int().min(2, "Mínimo 2 meses").optional(),
  ativa: z.boolean(),
}).refine(
  (d) => d.recorrencia !== "parcelada" || (d.mesesTotal && d.mesesTotal >= 2),
  { message: "Informe a quantidade de meses (mínimo 2)", path: ["mesesTotal"] }
);

export type ReceitaFormData = z.infer<typeof schema>;

export type ReceitaPayload = {
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  responsavel: string;
  recorrente: boolean;
  parcelada: boolean;
  mesesTotal?: number | null;
  excecoes: string[];
  ativa: boolean;
};

interface Props {
  defaultValues?: Partial<ReceitaFormData>;
  onSubmit: (data: ReceitaPayload) => Promise<void>;
  loading?: boolean;
}

const tipoOptions = ["Adiantamento", "Aluguel", "Férias", "Freelance", "Investimento", "Outro", "Receitas de Terceiros", "Salário"];

export function ReceitaForm({ defaultValues, onSubmit, loading }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReceitaFormData>({
    resolver: zodResolver(schema) as Resolver<ReceitaFormData>,
    defaultValues: { ativa: true, recorrencia: "unica", ...defaultValues },
  });

  const recorrencia = watch("recorrencia");
  const tipo = watch("tipo");

  const handleFormSubmit = (data: ReceitaFormData) => {
    const payload: ReceitaPayload = {
      descricao: data.descricao,
      tipo: data.tipo,
      valor: data.valor,
      data: data.data,
      responsavel: data.responsavel,
      recorrente: data.recorrencia === "recorrente",
      parcelada: data.recorrencia === "parcelada",
      mesesTotal: data.recorrencia === "parcelada" ? data.mesesTotal : null,
      excecoes: [],
      ativa: data.ativa,
    };
    return onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Field label="Descrição" error={errors.descricao?.message}>
        <input {...register("descricao")} className={inputClass} placeholder="Ex: Salário mensal" />
      </Field>

      <Field label="Tipo" error={errors.tipo?.message}>
        <input {...register("tipo")} list="tipos-receita" className={inputClass} placeholder="Selecione ou digite..." />
        <datalist id="tipos-receita">
          {tipoOptions.map((t) => <option key={t} value={t} />)}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor (R$)" error={errors.valor?.message}>
          <input {...register("valor")} type="number" step="0.01" className={inputClass} placeholder="0,00" />
        </Field>
        <Field label="Data início" error={errors.data?.message}>
          <input {...register("data")} type="date" className={inputClass} />
        </Field>
      </div>

      <Field label="Responsável" error={errors.responsavel?.message}>
        <input {...register("responsavel")} className={inputClass} placeholder="Nome do responsável" />
      </Field>

      <Field label="Tipo de recorrência" error={errors.recorrencia?.message}>
        <div className="flex gap-2">
          {(["unica", "recorrente", "parcelada"] as const).map((opt) => (
            <label key={opt} className={`flex-1 flex items-center justify-center gap-1.5 border rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${recorrencia === opt ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              <input {...register("recorrencia")} type="radio" value={opt} className="sr-only" />
              {opt === "unica" ? "Única" : opt === "recorrente" ? "Recorrente" : "Parcelada"}
            </label>
          ))}
        </div>
      </Field>

      {tipo === "Férias" && (
        <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
          <p>Ao salvar, o sistema pedirá confirmação e aplicará automaticamente as exceções nos meses de <strong>Salário</strong> e <strong>Adiantamento</strong> afetados pelas férias.</p>
        </div>
      )}

      {recorrencia === "parcelada" && (
        <Field label="Quantidade de meses" error={errors.mesesTotal?.message}>
          <input
            {...register("mesesTotal")}
            type="number"
            min={2}
            className={inputClass}
            placeholder="Ex: 10"
          />
        </Field>
      )}

      {defaultValues && (
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input {...register("ativa")} type="checkbox" className="rounded" />
          Ativa
        </label>
      )}

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
