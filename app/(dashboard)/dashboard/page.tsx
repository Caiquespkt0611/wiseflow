"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { MonthSelector } from "@/components/ui/MonthSelector";

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

interface MesProjecao {
  mes: number;
  ano: number;
  previsaoAcumulada: number;
}

/** Junta fixas e cartão por categoria: a pergunta é para onde vai o dinheiro, não por qual canal. */
function somarCategorias(...listas: CategoriaItem[][]) {
  const mapa = new Map<string, number>();
  for (const lista of listas) for (const c of lista) mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.valor);
  return Array.from(mapa, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [proximos, setProximos] = useState<MesProjecao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const mes = currentDate.getMonth() + 1;
    const ano = currentDate.getFullYear();
    const res = await fetch(`/api/dashboard?mes=${mes}&ano=${ano}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [currentDate]);

  const fetchProximos = useCallback(async () => {
    const res = await fetch("/api/projecao");
    if (res.ok) setProximos(((await res.json()).projecao ?? []).slice(0, 6));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchProximos(); }, [fetchProximos]);
  useAoLancar(fetchData);
  useAoLancar(fetchProximos);

  const mesNome = format(currentDate, "MMMM", { locale: ptBR });
  const categorias = somarCategorias(data?.categoriasFixas ?? [], data?.categoriasVariaveis ?? []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-tinta-900">Painel do mês</h1>
          <p className="mt-1 text-sm text-tinta-500">O que ainda falta entrar e sair até o fim de {mesNome}.</p>
        </div>
        <MonthSelector date={currentDate} onChange={setCurrentDate} />
      </div>

      {loading || !data ? (
        <div className="space-y-4" aria-busy>
          <div className="h-72 rounded-3xl bg-tinta-100 animate-pulse" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 rounded-2xl bg-tinta-100 animate-pulse" />
            <div className="h-64 rounded-2xl bg-tinta-100 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <Conta data={data} mesNome={mesNome} />

          {proximos.length > 1 && <Proximos meses={proximos} />}

          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <Barras
              titulo="Para onde vai o dinheiro"
              apoio="Contas do mês e parcelas, somadas por categoria"
              itens={categorias}
              total={data.totalDespesas}
              vazio={`Nada a pagar em ${mesNome}.`}
            />
            <Barras
              titulo="Por cartão"
              apoio="Parcelas que caem neste mês"
              itens={data.cartaoVariaveis}
              total={data.totalVariaveis}
              vazio={`Nenhuma parcela de cartão em ${mesNome}.`}
              link={{ href: "/despesas-variaveis", texto: "Ver cartões" }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** A previsão com a conta que leva até ela, para dar para confiar no número. */
function Conta({ data, mesNome }: { data: DashboardData; mesNome: string }) {
  const sobra = data.previsao;
  const linhas = [
    {
      sinal: "",
      rotulo: data.isFuturo ? "Saldo projetado no início do mês" : "Saldo nas contas agora",
      valor: data.saldoBancario,
      detalhe: data.isFuturo ? "o que deve sobrar dos meses anteriores" : null,
      href: "/contas",
    },
    {
      sinal: "+",
      rotulo: "Ainda vai entrar",
      valor: data.totalReceitas,
      detalhe: `${formatCurrency(data.totalReceitasFixas)} fixas e ${formatCurrency(data.totalReceitasVariaveis)} parceladas`,
      href: "/receitas-variaveis",
    },
    {
      sinal: "−",
      rotulo: "Ainda vai sair",
      valor: data.totalDespesas,
      detalhe: `${formatCurrency(data.totalFixas)} em contas e ${formatCurrency(data.totalVariaveis)} em cartões`,
      href: "/despesas-variaveis",
    },
  ];

  return (
    <section className="rounded-3xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 bg-marca-50/60 lg:border-r border-b lg:border-b-0 border-tinta-200">
          <p className="text-sm text-tinta-600">Sobra prevista no fim de {mesNome}</p>
          <p
            className={cn(
              "valor font-semibold tracking-tight leading-none text-[44px] sm:text-[56px] lg:text-[64px]",
              sobra >= 0 ? "text-tinta-900" : "text-saida-600"
            )}
          >
            {formatCurrency(sobra)}
          </p>
          <p className="text-sm text-tinta-500">
            {sobra >= 0 ? "Se tudo entrar e sair como está lançado." : "Falta dinheiro para fechar o mês com o que está lançado."}
          </p>
        </div>

        <dl className="p-2 sm:p-3">
          {linhas.map((l) => (
            <Link key={l.rotulo} href={l.href} className="group grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2 rounded-xl px-3 sm:px-4 py-3.5 hover:bg-tinta-50 transition-colors">
              <span className="valor text-lg text-tinta-400" aria-hidden>{l.sinal}</span>
              <dt className="text-[15px] text-tinta-800">
                {l.rotulo}
                {l.detalhe && <span className="block text-xs text-tinta-500 mt-0.5">{l.detalhe}</span>}
              </dt>
              <dd className={cn("valor text-lg font-medium", l.sinal === "−" ? "text-saida-600" : l.sinal === "+" ? "text-marca-700" : "text-tinta-900")}>
                {formatCurrency(l.valor)}
              </dd>
            </Link>
          ))}
          <div className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2 mx-3 sm:mx-4 mt-1 pt-3.5 pb-2 border-t border-tinta-200">
            <span className="valor text-lg text-tinta-400" aria-hidden>=</span>
            <dt className="text-[15px] font-medium text-tinta-900">Sobra prevista</dt>
            <dd className={cn("valor text-lg font-semibold", sobra >= 0 ? "text-tinta-900" : "text-saida-600")}>{formatCurrency(sobra)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** Os próximos meses da projeção, para ver o rumo sem sair do painel. */
function Proximos({ meses }: { meses: MesProjecao[] }) {
  return (
    <Link
      href="/projecao"
      className="mt-4 flex items-stretch overflow-x-auto rounded-2xl bg-superficie ring-1 ring-tinta-200 hover:ring-tinta-300 transition-shadow"
      aria-label="Abrir a projeção"
    >
      {meses.map((m, i) => (
        <div key={`${m.ano}-${m.mes}`} className={cn("flex-1 min-w-[112px] px-4 py-3", i > 0 && "border-l border-tinta-100")}>
          <p className="text-xs text-tinta-500 capitalize">
            {format(new Date(m.ano, m.mes - 1, 1), "MMM yy", { locale: ptBR }).replace(".", "")}
          </p>
          <p className={cn("valor text-sm font-medium mt-0.5", m.previsaoAcumulada >= 0 ? "text-tinta-900" : "text-saida-600")}>
            {formatCurrency(m.previsaoAcumulada)}
          </p>
        </div>
      ))}
    </Link>
  );
}

/** Barras horizontais de uma cor só: o que importa é o tamanho, e o rótulo fica em texto. */
function Barras({
  titulo,
  apoio,
  itens,
  total,
  vazio,
  link,
}: {
  titulo: string;
  apoio: string;
  itens: CategoriaItem[];
  total: number;
  vazio: string;
  link?: { href: string; texto: string };
}) {
  const maior = itens[0]?.valor ?? 0;
  const visiveis = itens.slice(0, 7);
  const resto = itens.slice(7).reduce((s, i) => s + i.valor, 0);
  if (resto > 0) visiveis.push({ categoria: "Outras", valor: resto });

  return (
    <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-tinta-900">{titulo}</h2>
          <p className="text-xs text-tinta-500 mt-0.5">{apoio}</p>
        </div>
        {link && (
          <Link href={link.href} className="text-sm text-marca-700 hover:underline underline-offset-4 flex-shrink-0">
            {link.texto}
          </Link>
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-tinta-500">{vazio}</p>
      ) : (
        <ul className="space-y-3.5">
          {visiveis.map((c) => {
            const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
            return (
              <li key={c.categoria} title={`${c.categoria}: ${formatCurrency(c.valor)} (${pct}%)`}>
                <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                  <span className="text-tinta-700 truncate">{c.categoria}</span>
                  <span className="valor text-tinta-900 font-medium flex-shrink-0">
                    {formatCurrency(c.valor)}
                    <span className="text-tinta-400 font-normal ml-2 inline-block w-9 text-right">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-tinta-100 overflow-hidden">
                  <div className="h-full rounded-full bg-tinta-700" style={{ width: `${maior > 0 ? Math.max(2, (c.valor / maior) * 100) : 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
