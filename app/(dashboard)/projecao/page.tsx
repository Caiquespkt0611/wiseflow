"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { useCoresGrafico } from "@/lib/cores-grafico";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ProjecaoMes {
  mes: number;
  ano: number;
  label: string;
  isAtual: boolean;
  totalReceitas: number;
  totalDespesas: number;
  totalFixas: number;
  totalVariaveis: number;
  previsaoMes: number;
  previsaoAcumulada: number;
  // campos simulados
  previsaoMesSim?: number;
  previsaoAcumuladaSim?: number;
  totalDespesasSim?: number;
}

const simSchema = z.object({
  descricao: z.string().min(1, "Diga o que é"),
  valorTotal: z.number({ message: "Informe o valor" }).positive("Informe o valor"),
  parcelas: z.number().int().min(1).max(60),
  mesInicio: z.number().int().min(1),
});
type SimFormData = z.infer<typeof simSchema>;

const inputClass =
  "campo";

const mesCurto = (m: ProjecaoMes) => format(new Date(m.ano, m.mes - 1, 1), "MMM yy", { locale: ptBR }).replace(".", "");

const compacto = (value: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export default function ProjecaoPage() {
  const cores = useCoresGrafico();
  const [base, setBase] = useState<ProjecaoMes[]>([]);
  const [saldoBancario, setSaldoBancario] = useState(0);
  const [loading, setLoading] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [simAtiva, setSimAtiva] = useState<string | null>(null);
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
      setSimAtiva(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  const aplicarSimulacao = (form: SimFormData) => {
    const parcela = form.valorTotal / form.parcelas;
    let acumSim = saldoBancario;

    const novo = base.map((row, i) => {
      const mesIdx = i + 1;
      const temParcela = mesIdx >= form.mesInicio && mesIdx < form.mesInicio + form.parcelas;
      const totalDespesasSim = row.totalDespesas + (temParcela ? parcela : 0);
      const previsaoMesSim = row.totalReceitas - totalDespesasSim;
      acumSim += previsaoMesSim;
      return { ...row, totalDespesasSim, previsaoMesSim, previsaoAcumuladaSim: acumSim };
    });

    setData(novo);
    setSimAtiva(form.descricao);
  };

  const limparSimulacao = () => {
    setData(base);
    setSimAtiva(null);
    reset({ mesInicio: 1, parcelas: 12 });
  };

  const parcelas = watch("parcelas");
  const valorTotal = watch("valorTotal");
  const valorParcela = parcelas > 0 && valorTotal > 0 ? valorTotal / parcelas : 0;

  const ultimo = data[data.length - 1];
  const fimSem = ultimo?.previsaoAcumulada ?? 0;
  const fimCom = ultimo?.previsaoAcumuladaSim ?? fimSem;
  const menor = data.reduce<ProjecaoMes | null>((m, d) => (!m || d.previsaoAcumulada < m.previsaoAcumulada ? d : m), null);
  const n = data.length || 1;
  const primeiraNegativa = data.find((d) => (simAtiva ? (d.previsaoAcumuladaSim ?? 0) : d.previsaoAcumulada) < 0);

  const grafico = data.map((d) => ({ ...d, rotulo: mesCurto(d) }));

  return (
    <div className="max-w-5xl mx-auto">
      <Cabecalho
        titulo="Projeção"
        subtitulo={`Quanto deve ter em conta no fim de cada mês, partindo de ${formatCurrency(saldoBancario)} de hoje e somando tudo o que está lançado.`}
      >
        <button
          onClick={() => setSimOpen((v) => !v)}
          aria-expanded={simOpen}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-superficie ring-1 ring-tinta-200 text-sm font-medium text-tinta-800 hover:bg-tinta-100 transition-colors"
        >
          Simular uma compra
          <ChevronDown className={cn("w-4 h-4 text-tinta-400 transition-transform duration-200", simOpen && "rotate-180")} />
        </button>
      </Cabecalho>

      {simOpen && (
        <form onSubmit={handleSubmit(aplicarSimulacao)} className="mb-6 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 animate-fade-in">
          <p className="text-sm text-tinta-600 mb-4">Veja como uma compra parcelada mexe no saldo dos próximos meses, sem gravar nada.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2 sm:col-span-1 block">
              <span className="block text-xs font-medium text-tinta-600 mb-1">O que é</span>
              <input {...register("descricao")} className={inputClass} placeholder="TV nova" />
              {errors.descricao && <span className="text-saida-600 text-xs mt-1 block">{errors.descricao.message}</span>}
            </label>
            <label className="col-span-2 sm:col-span-1 block">
              <span className="block text-xs font-medium text-tinta-600 mb-1">Valor total</span>
              <input {...register("valorTotal", { valueAsNumber: true })} type="number" inputMode="decimal" step="0.01" className={cn(inputClass, "valor")} placeholder="0,00" />
              {errors.valorTotal && <span className="text-saida-600 text-xs mt-1 block">{errors.valorTotal.message}</span>}
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-tinta-600 mb-1">Parcelas</span>
              <input {...register("parcelas", { valueAsNumber: true })} type="number" inputMode="numeric" min={1} max={60} className={cn(inputClass, "valor")} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-tinta-600 mb-1">Primeira em</span>
              <select {...register("mesInicio", { valueAsNumber: true })} className={inputClass}>
                {base.map((m, i) => (
                  <option key={m.label} value={i + 1}>{mesCurto(m)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button type="submit" className="px-4 py-2.5 rounded-lg bg-marca hover:bg-marca-forte text-white text-sm font-medium transition-colors">
              Simular
            </button>
            {valorParcela > 0 && <span className="valor text-sm text-tinta-600">{formatCurrency(valorParcela)} por mês</span>}
          </div>
        </form>
      )}

      {simAtiva && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl bg-aviso-50 ring-1 ring-aviso-200 px-4 py-3">
          <p className="text-sm text-aviso-800">
            Simulando <strong className="font-semibold">{simAtiva}</strong>. No fim do período você teria{" "}
            <span className="valor font-semibold">{formatCurrency(fimCom)}</span>, {formatCurrency(fimSem - fimCom)} a menos.
          </p>
          <button onClick={limparSimulacao} className="flex items-center gap-1 text-sm font-medium text-aviso-800 hover:underline underline-offset-4 flex-shrink-0">
            <X className="w-4 h-4" /> Tirar
          </button>
        </div>
      )}

      {!loading && primeiraNegativa && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-saida-50 ring-1 ring-saida-200 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-saida-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-saida-700">
            O saldo fica negativo em <strong className="font-semibold">{mesCurto(primeiraNegativa)}</strong>. Antes disso, corte uma despesa ou antecipe uma entrada.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4" aria-busy>
          <div className="h-80 rounded-2xl bg-tinta-100 animate-pulse" />
          <div className="h-80 rounded-2xl bg-tinta-100 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Saldo no fim de cada mês: é a pergunta que a tela responde */}
          <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-tinta-900">Saldo no fim de cada mês</h2>
                <p className="text-xs text-tinta-500 mt-0.5">
                  {simAtiva ? "Linha cheia: como está. Tracejada: com a compra simulada." : "Se tudo entrar e sair como está lançado."}
                </p>
              </div>
              <dl className="flex gap-8">
                <div>
                  <dt className="text-xs text-tinta-500">Em {ultimo ? mesCurto(ultimo) : ""}</dt>
                  <dd className="valor text-xl font-semibold text-tinta-900">{formatCurrency(simAtiva ? fimCom : fimSem)}</dd>
                </div>
                {menor && (
                  <div>
                    <dt className="text-xs text-tinta-500">Mais apertado, em {mesCurto(menor)}</dt>
                    <dd className="valor text-xl font-semibold text-tinta-900">{formatCurrency(menor.previsaoAcumulada)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="h-64 sm:h-72 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cores.saldo} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={cores.saldo} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={cores.grade} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tickFormatter={compacto} tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} width={64} />
                  <ReferenceLine y={0} stroke={cores.eixo} strokeOpacity={0.4} />
                  <Tooltip content={<DicaSaldo />} cursor={{ stroke: cores.eixo, strokeOpacity: 0.3 }} />
                  <Area type="monotone" dataKey="previsaoAcumulada" name="Saldo" stroke={cores.saldo} strokeWidth={2} fill="url(#saldoArea)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                  {simAtiva && (
                    <Line type="monotone" dataKey="previsaoAcumuladaSim" name="Com a compra" stroke={cores.simulado} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Entra e sai */}
          <section className="mt-4 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-tinta-900">Quanto entra e quanto sai</h2>
                <p className="text-xs text-tinta-500 mt-0.5">
                  Média por mês: entra <span className="valor text-tinta-700">{formatCurrency(data.reduce((s, d) => s + d.totalReceitas, 0) / n)}</span>, sai{" "}
                  <span className="valor text-tinta-700">{formatCurrency(data.reduce((s, d) => s + d.totalDespesas, 0) / n)}</span>
                </p>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-600">
                <Legenda cor={cores.entra} texto="Entra" />
                <Legenda cor={cores.contas} texto="Contas do mês" />
                <Legenda cor={cores.cartoes} texto="Cartões" />
              </ul>
            </div>
            <div className="h-64 sm:h-72 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke={cores.grade} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tickFormatter={compacto} tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip content={<DicaBarras />} cursor={{ fill: cores.grade, opacity: 0.6 }} />
                  <Bar dataKey="totalReceitas" name="Entra" fill={cores.entra} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalFixas" name="Contas do mês" fill={cores.contas} stackId="sai" />
                  <Bar dataKey="totalVariaveis" name="Cartões" fill={cores.cartoes} radius={[4, 4, 0, 0]} stackId="sai" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Tabela: os mesmos números, para conferir linha a linha */}
          <section className="mt-4 rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tinta-200 text-xs text-tinta-500">
                    <th className="px-4 py-3 text-left font-medium">Mês</th>
                    <th className="px-4 py-3 text-right font-medium">Começa com</th>
                    <th className="px-4 py-3 text-right font-medium">Entra</th>
                    <th className="px-4 py-3 text-right font-medium">Contas</th>
                    <th className="px-4 py-3 text-right font-medium">Cartões</th>
                    <th className="px-4 py-3 text-right font-medium">Termina com</th>
                    {simAtiva && <th className="px-4 py-3 text-right font-medium">Com a compra</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-tinta-100">
                  {data.map((row, i) => {
                    const comeca = i === 0 ? saldoBancario : data[i - 1].previsaoAcumulada;
                    return (
                      <tr key={row.label} className={cn("valor", row.isAtual && "bg-marca-50/50")}>
                        <td className="px-4 py-3 text-tinta-900 whitespace-nowrap capitalize">
                          {mesCurto(row)}
                          {row.isAtual && <span className="ml-2 text-xs text-marca-700 normal-case">este mês</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-tinta-500 whitespace-nowrap">{formatCurrency(comeca)}</td>
                        <td className="px-4 py-3 text-right text-marca-700 whitespace-nowrap">{formatCurrency(row.totalReceitas)}</td>
                        <td className="px-4 py-3 text-right text-tinta-700 whitespace-nowrap">−{formatCurrency(row.totalFixas)}</td>
                        <td className="px-4 py-3 text-right text-tinta-700 whitespace-nowrap">−{formatCurrency(row.totalVariaveis)}</td>
                        <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", row.previsaoAcumulada >= 0 ? "text-tinta-900" : "text-saida-600")}>
                          {formatCurrency(row.previsaoAcumulada)}
                        </td>
                        {simAtiva && (
                          <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", (row.previsaoAcumuladaSim ?? 0) >= 0 ? "text-aviso-700" : "text-saida-600")}>
                            {formatCurrency(row.previsaoAcumuladaSim ?? 0)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} aria-hidden />
      {texto}
    </li>
  );
}

interface ItemDica {
  name: string;
  value: number;
  color?: string;
  payload: ProjecaoMes & { rotulo: string };
}

function DicaSaldo({ active, payload }: { active?: boolean; payload?: ItemDica[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-tinta-200 shadow-lg px-3 py-2.5 text-xs">
      <p className="font-medium text-tinta-900 capitalize mb-1">Fim de {m.rotulo}</p>
      {payload.map((p) => (
        <p key={p.name} className="valor flex justify-between gap-4 text-tinta-600">
          <span>{p.name}</span>
          <span className="text-tinta-900 font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
      <p className="valor flex justify-between gap-4 text-tinta-500 mt-1 pt-1 border-t border-tinta-100">
        <span>No mês</span>
        <span>{m.previsaoMes >= 0 ? "+" : "−"}{formatCurrency(Math.abs(m.previsaoMes))}</span>
      </p>
    </div>
  );
}

function DicaBarras({ active, payload }: { active?: boolean; payload?: ItemDica[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-tinta-200 shadow-lg px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-medium text-tinta-900 capitalize mb-1">{m.rotulo}</p>
      {payload.map((p) => (
        <p key={p.name} className="valor flex items-center justify-between gap-4 text-tinta-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="text-tinta-900 font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
      <p className="valor flex justify-between gap-4 text-tinta-500 mt-1 pt-1 border-t border-tinta-100">
        <span>Sobra no mês</span>
        <span className="text-tinta-900">{m.previsaoMes >= 0 ? "+" : "−"}{formatCurrency(Math.abs(m.previsaoMes))}</span>
      </p>
    </div>
  );
}
