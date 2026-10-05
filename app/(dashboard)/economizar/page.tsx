"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { Cabecalho } from "@/components/ui/Cabecalho";
import type { Economia, Achado } from "@/lib/economia";

const TOM = {
  corte: { rotulo: "Cortar", classe: "bg-saida-50 text-saida-700" },
  atencao: { rotulo: "Dá para reduzir", classe: "bg-aviso-50 text-aviso-800" },
  info: { rotulo: "Ficar de olho", classe: "bg-tinta-100 text-tinta-600" },
} as const;

const VISIVEIS = 6;

export default function EconomizarPage() {
  const [dados, setDados] = useState<Economia | null>(null);

  const buscar = useCallback(async () => {
    const res = await fetch("/api/economizar");
    if (res.ok) setDados(await res.json());
  }, []);
  useEffect(() => { buscar(); }, [buscar]);
  useAoLancar(buscar);

  if (!dados) {
    return (
      <div className="max-w-5xl mx-auto grid gap-4" aria-busy>
        <div className="h-10 w-64 rounded-lg bg-tinta-100 animate-pulse" />
        <div className="h-72 rounded-2xl bg-tinta-100 animate-pulse" />
        <div className="h-72 rounded-2xl bg-tinta-100 animate-pulse" />
      </div>
    );
  }

  const maior = dados.categorias[0]?.porMes ?? 1;

  return (
    <div className="max-w-5xl mx-auto">
      <Cabecalho
        titulo="Onde economizar"
        subtitulo={
          <>
            O que sai por mês nos próximos {dados.meses} meses e onde dá para cortar. É separado do plano de quitação, mas todo real cortado aqui vira antecipação lá em{" "}
            <Link href="/quitacao" className="text-marca-700 font-medium hover:underline underline-offset-4">Quitar empréstimos</Link>.
          </>
        }
      />

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
        {/* Para onde vai o dinheiro do casal */}
        <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6 lg:sticky lg:top-10">
          <h2 className="text-[15px] font-semibold text-tinta-900">Para onde vai o dinheiro</h2>
          <p className="text-xs text-tinta-500 mt-0.5">
            Média de <span className="valor text-tinta-700">{formatCurrency(dados.saidaMedia)}</span> por mês em contas e cartões. Sem empréstimos, sem custo da empresa e
            sem compra que alguém devolve.
          </p>
          <ul className="mt-5 grid gap-3">
            {dados.categorias.map((c) => (
              <li key={c.categoria}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-tinta-800">{c.categoria}</span>
                  <span className="valor text-tinta-900 font-medium">
                    {formatCurrency(c.porMes)} <span className="text-xs font-normal text-tinta-500 w-9 inline-block text-right">{Math.round(c.fatia * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-tinta-100 overflow-hidden">
                  <div className="h-full rounded-full bg-saida-400" style={{ width: `${(c.porMes / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* O que dá para fazer */}
        <div className="grid gap-4">
          {dados.achados.map((a) => (
            <CartaoAchado key={a.chave} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CartaoAchado({ a }: { a: Achado }) {
  const [aberto, setAberto] = useState(false);
  const tom = TOM[a.tom];
  const itens = aberto ? a.itens : a.itens.slice(0, VISIVEIS);
  return (
    <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <span className={cn("text-[11px] font-medium px-2 py-1 rounded-md", tom.classe)}>{tom.rotulo}</span>
          <h2 className="mt-2 text-[17px] font-semibold text-tinta-900">{a.titulo}</h2>
        </div>
        <div className="text-right">
          {a.destaque ? (
            <p className="valor text-[15px] font-semibold text-tinta-900">{a.destaque}</p>
          ) : (
            <>
              <p className="valor text-xl font-semibold text-tinta-900">
                {formatCurrency(a.porMes)}
                <span className="text-xs font-normal text-tinta-500"> /mês</span>
              </p>
              <p className="valor text-xs text-tinta-500">{formatCurrency(a.porAno)} por ano</p>
            </>
          )}
        </div>
      </header>

      <p className="mt-3 text-sm text-tinta-700 leading-relaxed">{a.texto}</p>

      <ul className="mt-4 divide-y divide-tinta-100 border-t border-tinta-100">
        {itens.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-tinta-900 truncate">{i.descricao}</p>
              <p className="text-xs text-tinta-500 truncate">
                {i.onde}
                {i.restam !== undefined && i.restam > 0 && ` · faltam ${i.restam} ${i.restam === 1 ? "parcela" : "parcelas"}`}
                {i.reembolsado && " · tem reembolso lançado"}
              </p>
            </div>
            <p className="valor text-sm font-medium text-tinta-900 whitespace-nowrap">{formatCurrency(i.porMes)}</p>
          </li>
        ))}
      </ul>
      {a.itens.length > VISIVEIS && (
        <button
          onClick={() => setAberto((v) => !v)}
          className="mt-2 flex items-center gap-1 text-sm font-medium text-tinta-600 hover:text-tinta-900"
          aria-expanded={aberto}
        >
          {aberto ? "Mostrar menos" : `Ver todas as ${a.itens.length}`}
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", aberto && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
