"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ProjecaoMes {
  mes: number;
  ano: number;
  label: string;
  totalReceitas: number;
  totalDespesas: number;
  totalFixas: number;
  totalVariaveis: number;
  psiMes: number;
  psiAcumulado: number;
  // campos simulados
  psiMesSim?: number;
  psiAcumuladoSim?: number;
  totalDespesasSim?: number;
}

const simSchema = z.object({
  descricao: z.string().min(1, "Informe o nome"),
  valorTotal: z.number().positive("Valor deve ser positivo"),
  parcelas: z.number().int().min(1).max(60),
  mesInicio: z.number().int().min(1).max(12),
});
type SimFormData = z.infer<typeof simSchema>;

export default function ProjecaoPage() {
  const [base, setBase] = useState<ProjecaoMes[]>([]);
  const [saldoBancario, setSaldoBancario] = useState(0);
  const [loading, setLoading] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [simAtiva, setSimAtiva] = useState(false);
  const [data, setData] = useState<ProjecaoMes[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SimFormData>({
    resolver: zodResolver(simSchema),
    defaultValues: { mesInicio: 1, parcelas: 12 },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const res = await fetch(`/api/projecao?mes=${now.getMonth() + 1}&ano=${now.getFullYear()}`);
    if (res.ok) {
      const json = await res.json();
      setBase(json.projecao);
      setSaldoBancario(json.saldoBancario);
      setData(json.projecao);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const aplicarSimulacao = (form: SimFormData) => {
    const parcela = form.valorTotal / form.parcelas;
    let psiAcum = saldoBancario;

    const novo = base.map((row, i) => {
      const mesIdx = i + 1;
      const temParcela = mesIdx >= form.mesInicio && mesIdx < form.mesInicio + form.parcelas;
      const despesaExtra = temParcela ? parcela : 0;
      const totalDespesasSim = row.totalDespesas + despesaExtra;
      const psiMesSim = row.totalReceitas - totalDespesasSim;
      psiAcum += psiMesSim;
      return {
        ...row,
        totalDespesasSim,
        psiMesSim,
        psiAcumuladoSim: psiAcum,
      };
    });

    setData(novo);
    setSimAtiva(true);
  };

  const limparSimulacao = () => {
    setData(base);
    setSimAtiva(false);
    reset({ mesInicio: 1, parcelas: 12 });
  };

  const formatYAxis = (value: number) =>
    new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL" }).format(value);

  interface TooltipPayloadItem { name: string; value: number; color: string; }
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    );
  };

  const parcelas = watch("parcelas");
  const valorTotal = watch("valorTotal");
  const valorParcela = parcelas > 0 && valorTotal > 0 ? valorTotal / parcelas : 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projeção 12 Meses</h1>
        <p className="text-sm text-gray-500 mt-1">
          PSI acumulado partindo do saldo atual em contas ({formatCurrency(saldoBancario)})
        </p>
      </div>

      {/* Simulador */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <button
          onClick={() => setSimOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="bg-violet-100 p-2 rounded-xl">
              <Calculator className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Simulador de Compra / Investimento</p>
              <p className="text-xs text-gray-500">Veja o impacto de uma nova despesa na sua projeção</p>
            </div>
          </div>
          {simOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {simOpen && (
          <div className="border-t border-gray-100 px-5 py-5">
            <form onSubmit={handleSubmit(aplicarSimulacao)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                  <input
                    {...register("descricao")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Ex: TV nova, Notebook, Investimento..."
                  />
                  {errors.descricao && <p className="text-red-500 text-xs mt-1">{errors.descricao.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total (R$)</label>
                  <input
                    {...register("valorTotal", { valueAsNumber: true })}
                    type="number" step="0.01"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="0,00"
                  />
                  {errors.valorTotal && <p className="text-red-500 text-xs mt-1">{errors.valorTotal.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Parcelas</label>
                  <input
                    {...register("parcelas", { valueAsNumber: true })}
                    type="number" min={1} max={60}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {errors.parcelas && <p className="text-red-500 text-xs mt-1">{errors.parcelas.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Começa no mês (1 = atual)</label>
                  <input
                    {...register("mesInicio", { valueAsNumber: true })}
                    type="number" min={1} max={12}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {errors.mesInicio && <p className="text-red-500 text-xs mt-1">{errors.mesInicio.message}</p>}
                </div>
              </div>

              {valorParcela > 0 && (
                <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-violet-700 font-medium">Parcela mensal:</span>
                  <span className="text-base font-bold text-violet-700">{formatCurrency(valorParcela)}/mês</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-violet-500 hover:bg-violet-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Simular impacto
                </button>
                {simAtiva && (
                  <button
                    type="button"
                    onClick={limparSimulacao}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-6">
          <div className="bg-white rounded-2xl h-80 animate-pulse bg-gray-100" />
          <div className="bg-white rounded-2xl h-80 animate-pulse bg-gray-100" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Saldo Inicial", value: saldoBancario, color: "text-teal-600" },
              { label: "Receita Média", value: data.reduce((s, d) => s + d.totalReceitas, 0) / 12, color: "text-emerald-600" },
              { label: "Despesa Média", value: data.reduce((s, d) => s + d.totalDespesas, 0) / 12, color: "text-red-600" },
              {
                label: simAtiva ? "PSI Acumulado (sim)" : "PSI Acumulado 12m",
                value: simAtiva
                  ? (data[data.length - 1]?.psiAcumuladoSim ?? 0)
                  : (data[data.length - 1]?.psiAcumulado ?? 0),
                color: ((simAtiva ? data[data.length - 1]?.psiAcumuladoSim : data[data.length - 1]?.psiAcumulado) ?? 0) >= 0
                  ? "text-emerald-600" : "text-red-600",
              },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className={`text-base sm:text-lg font-bold ${item.color} break-all`}>
                  {formatCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>

          {/* Receitas vs Despesas */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <h2 className="text-base font-semibold text-gray-800 mb-4 sm:mb-6">
              Receitas vs Despesas por Mês
            </h2>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="totalReceitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalFixas" name="Fixas" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="despesas" />
                  <Bar dataKey="totalVariaveis" name="Variáveis" fill="#f97316" radius={[4, 4, 0, 0]} stackId="despesas" />
                  {simAtiva && (
                    <Bar dataKey="totalDespesasSim" name="Despesas (simulado)" fill="#a855f7" radius={[4, 4, 0, 0]} opacity={0.6} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PSI acumulado */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              PSI Acumulado
            </h2>
            <p className="text-xs text-gray-400 mb-4">Parte de {formatCurrency(saldoBancario)} (saldo atual em contas)</p>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="psiMes" name="PSI Mensal" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="psiAcumulado" name="PSI Acumulado" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  {simAtiva && (
                    <>
                      <Line type="monotone" dataKey="psiMesSim" name="PSI Mensal (sim)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="psiAcumuladoSim" name="PSI Acumulado (sim)" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Mês", "Receitas", "Fixas", "Variáveis", "Total Desp.", "PSI Mês", "PSI Acum.", ...(simAtiva ? ["PSI Mês (sim)", "PSI Acum. (sim)"] : [])].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((row) => (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.label}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{formatCurrency(row.totalReceitas)}</td>
                      <td className="px-4 py-3 text-sm text-red-500">{formatCurrency(row.totalFixas)}</td>
                      <td className="px-4 py-3 text-sm text-orange-500">{formatCurrency(row.totalVariaveis)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatCurrency(row.totalDespesas)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${row.psiMes >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCurrency(row.psiMes)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${row.psiAcumulado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(row.psiAcumulado)}
                      </td>
                      {simAtiva && (
                        <>
                          <td className={`px-4 py-3 text-sm font-medium ${(row.psiMesSim ?? 0) >= 0 ? "text-violet-600" : "text-red-600"}`}>
                            {formatCurrency(row.psiMesSim ?? 0)}
                          </td>
                          <td className={`px-4 py-3 text-sm font-bold ${(row.psiAcumuladoSim ?? 0) >= 0 ? "text-violet-700" : "text-red-600"}`}>
                            {formatCurrency(row.psiAcumuladoSim ?? 0)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
