"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  totalReceitas: number;
  totalDespesas: number;
  totalFixas: number;
  totalVariaveis: number;
  psi: number;
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const mes = currentDate.getMonth() + 1;
    const ano = currentDate.getFullYear();
    const res = await fetch(`/api/dashboard?mes=${mes}&ano=${ano}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const nextMonth = () => setCurrentDate((d) => addMonths(d, 1));

  const mesLabel = format(currentDate, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium capitalize w-36 text-center">{mesLabel}</span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Total Receitas"
              value={data?.totalReceitas ?? 0}
              icon={<TrendingUp className="w-6 h-6" />}
              color="emerald"
            />
            <StatCard
              title="Total Despesas"
              value={data?.totalDespesas ?? 0}
              icon={<TrendingDown className="w-6 h-6" />}
              color="red"
            />
            <StatCard
              title="PSI (Saldo Líquido)"
              value={data?.psi ?? 0}
              icon={<Wallet className="w-6 h-6" />}
              color={(data?.psi ?? 0) >= 0 ? "blue" : "orange"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-4">Despesas por Tipo</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fixas</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(data?.totalFixas ?? 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-red-400 rounded-full h-2"
                    style={{
                      width: `${data?.totalDespesas ? (data.totalFixas / data.totalDespesas) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Variáveis</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(data?.totalVariaveis ?? 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-orange-400 rounded-full h-2"
                    style={{
                      width: `${data?.totalDespesas ? (data.totalVariaveis / data.totalDespesas) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-4">Resumo</h3>
              <div className="space-y-3">
                <Row label="Receitas" value={data?.totalReceitas ?? 0} positive />
                <Row label="Despesas Fixas" value={-(data?.totalFixas ?? 0)} />
                <Row label="Despesas Variáveis" value={-(data?.totalVariaveis ?? 0)} />
                <div className="border-t pt-3">
                  <Row
                    label="PSI"
                    value={data?.psi ?? 0}
                    bold
                    positive={(data?.psi ?? 0) >= 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">{title}</span>
        <div className={`p-2 rounded-xl ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 break-all">{formatCurrency(value)}</p>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  const isPositive = positive ?? value >= 0;
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-600"}`}>
        {label}
      </span>
      <span
        className={`text-sm font-medium ${bold ? "font-bold" : ""} ${
          isPositive ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
