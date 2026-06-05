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
}

export default function ProjecaoPage() {
  const [data, setData] = useState<ProjecaoMes[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const res = await fetch(
      `/api/projecao?mes=${now.getMonth() + 1}&ano=${now.getFullYear()}`
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatYAxis = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      style: "currency",
      currency: "BRL",
    }).format(value);

  interface TooltipPayloadItem {
    name: string;
    value: number;
    color: string;
  }
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-sm">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Projeção 12 Meses</h1>
        <p className="text-sm text-gray-500 mt-1">
          Análise financeira projetada com PSI acumulado
        </p>
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
              {
                label: "Receita Média",
                value: data.reduce((s, d) => s + d.totalReceitas, 0) / 12,
                color: "text-emerald-600",
              },
              {
                label: "Despesa Média",
                value: data.reduce((s, d) => s + d.totalDespesas, 0) / 12,
                color: "text-red-600",
              },
              {
                label: "PSI Médio Mensal",
                value: data.reduce((s, d) => s + d.psiMes, 0) / 12,
                color: "text-blue-600",
              },
              {
                label: "PSI Acumulado 12m",
                value: data[data.length - 1]?.psiAcumulado ?? 0,
                color: (data[data.length - 1]?.psiAcumulado ?? 0) >= 0 ? "text-emerald-600" : "text-red-600",
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
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PSI acumulado */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-base font-semibold text-gray-800 mb-4 sm:mb-6">
              PSI Acumulado
            </h2>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="psiMes"
                    name="PSI Mensal"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="psiAcumulado"
                    name="PSI Acumulado"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
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
                    {["Mês", "Receitas", "Fixas", "Variáveis", "Total Despesas", "PSI Mês", "PSI Acumulado"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
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
