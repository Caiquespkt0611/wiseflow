"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Landmark } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { CATEGORIA_COLORS_BY_RANK } from "@/lib/categories";

interface CategoriaItem {
  categoria: string;
  valor: number;
}

interface DashboardData {
  totalReceitas: number;
  totalReceitasFixas: number;
  totalReceitasVariaveis: number;
  totalDespesas: number;
  totalFixas: number;
  totalVariaveis: number;
  previsao: number;
  saldoBancario: number;
  isFuturo: boolean;
  categoriasFixas: CategoriaItem[];
  categoriasVariaveis: CategoriaItem[];
  cartaoVariaveis: CategoriaItem[];
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 h-32 animate-pulse bg-gray-100" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-6 h-72 animate-pulse bg-gray-100" />
            <div className="bg-white rounded-2xl p-6 h-72 animate-pulse bg-gray-100" />
          </div>
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              title={data?.isFuturo ? "Saldo Projetado" : "Saldo em Contas"}
              value={data?.saldoBancario ?? 0}
              icon={<Landmark className="w-6 h-6" />}
              color={(data?.saldoBancario ?? 0) >= 0 ? "teal" : "orange"}
            />
            <StatCard
              title="Receitas Pendentes"
              value={data?.totalReceitas ?? 0}
              icon={<TrendingUp className="w-6 h-6" />}
              color="emerald"
            />
            <StatCard
              title="Despesas Pendentes"
              value={data?.totalDespesas ?? 0}
              icon={<TrendingDown className="w-6 h-6" />}
              color="red"
            />
            <StatCard
              title="Previsão Fim do Mês"
              value={data?.previsao ?? 0}
              icon={<Wallet className="w-6 h-6" />}
              color={(data?.previsao ?? 0) >= 0 ? "blue" : "orange"}
            />
          </div>

          {/* Donut Charts: fixas + variáveis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <DonutCard
              title="Despesas Fixas por Categoria"
              data={data?.categoriasFixas ?? []}
              total={data?.totalFixas ?? 0}
            />
            <DonutCard
              title="Despesas Variáveis por Categoria"
              data={data?.categoriasVariaveis ?? []}
              total={data?.totalVariaveis ?? 0}
            />
          </div>

          {/* Donut Chart: variáveis por cartão + Resumo lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <DonutCard
              title="Variáveis por Cartão de Crédito"
              data={data?.cartaoVariaveis ?? []}
              total={data?.totalVariaveis ?? 0}
            />
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-4">Resumo do Mês</h3>
              <div className="space-y-3">
                <Row label={data?.isFuturo ? "Saldo Projetado" : "Saldo em Contas"} value={data?.saldoBancario ?? 0} positive />
                <Row label="Receitas Fixas Pendentes" value={data?.totalReceitasFixas ?? 0} positive />
                <Row label="Receitas Variáveis Pendentes" value={data?.totalReceitasVariaveis ?? 0} positive />
                <Row label="Despesas Fixas Pendentes" value={-(data?.totalFixas ?? 0)} />
                <Row label="Despesas Variáveis Pendentes" value={-(data?.totalVariaveis ?? 0)} />
                <div className="border-t pt-3">
                  <Row
                    label="Previsão Fim do Mês"
                    value={data?.previsao ?? 0}
                    bold
                    positive={(data?.previsao ?? 0) >= 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Breakdowns por categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BreakdownCard
              title="Fixas por Categoria"
              items={data?.categoriasFixas ?? []}
            />
            <BreakdownCard
              title="Variáveis por Categoria"
              items={data?.categoriasVariaveis ?? []}
            />
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownCard({ title, items }: { title: string; items: CategoriaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-2">
        {items.slice(0, 8).map((c, i) => (
          <div key={c.categoria} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORIA_COLORS_BY_RANK[i] ?? CATEGORIA_COLORS_BY_RANK[CATEGORIA_COLORS_BY_RANK.length - 1] }} />
              <span className="text-sm text-gray-600">{c.categoria}</span>
            </div>
            <span className="text-sm font-medium text-gray-800">{formatCurrency(c.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutCard({ title, data, total }: { title: string; data: CategoriaItem[]; total: number }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Sem dados este mês
        </div>
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    ...d,
    fill: CATEGORIA_COLORS_BY_RANK[i] ?? CATEGORIA_COLORS_BY_RANK[CATEGORIA_COLORS_BY_RANK.length - 1],
    pct: total > 0 ? ((d.valor / total) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                dataKey="valor"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-400">Total</span>
            <span className="text-sm font-bold text-gray-800">{formatCurrency(total)}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2 w-full">
          {chartData.map((item, i) => (
            <div key={item.categoria} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-xs text-gray-600 flex-1 truncate">{item.categoria}</span>
              <span className="text-xs font-semibold" style={{ color: CATEGORIA_COLORS_BY_RANK[i] ?? "#71717a" }}>
                {item.pct}%
              </span>
              <span className="text-xs text-gray-500 w-20 text-right">{formatCurrency(item.valor)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { categoria: string; valor: number; pct: string }; fill: string }[] }) {
  if (!active || !payload?.length) return null;
  const { categoria, valor, pct } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800">{categoria}</p>
      <p className="text-gray-600">{formatCurrency(valor)} <span className="text-gray-400">({pct}%)</span></p>
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
    teal: "bg-teal-50 text-teal-600",
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
