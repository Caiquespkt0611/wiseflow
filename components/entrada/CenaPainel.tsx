"use client";

import { useEffect, useRef, useState } from "react";
import { SimboloMarca } from "@/components/ui/Marca";

/**
 * O Painel do mês de verdade (mesmas partes do /dashboard), com dados de
 * exemplo que fecham entre si: 3.140 + 6.480 − 7.355 = 2.265, e as
 * categorias somam os 7.355 que saem. Só aparece no computador.
 */
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CONTA = [
  { sinal: "", rotulo: "Saldo nas contas agora", valor: 3140 },
  { sinal: "+", rotulo: "Ainda vai entrar", valor: 6480 },
  { sinal: "−", rotulo: "Ainda vai sair", valor: 7355 },
];
const CATEGORIAS = [
  { nome: "Moradia", valor: 2450 },
  { nome: "Cartões", valor: 1905 },
  { nome: "Mercado", valor: 1380 },
  { nome: "Transporte", valor: 860 },
  { nome: "Outros", valor: 760 },
];
const MESES = [
  { mes: "nov", valor: 2265 },
  { mes: "dez", valor: 3010 },
  { mes: "jan", valor: 2480 },
  { mes: "fev", valor: 3720 },
  { mes: "mar", valor: 4650 },
  { mes: "abr", valor: 5900 },
];
const SOBRA = 2265;

/** Conta de 0 até o valor; com menos movimento já mostra o número. */
function useContador(alvo: number, ms = 1400, atraso = 500) {
  const [v, setV] = useState(alvo);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    let raf = 0;
    const t = setTimeout(() => {
      const ini = performance.now();
      const passo = (agora: number) => {
        const p = Math.min(1, (agora - ini) / ms);
        setV(alvo * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [alvo, ms, atraso]);
  return v;
}

/** Inclina de leve acompanhando o mouse. */
function useInclina() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mover = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.transform = `rotateY(${(-10 + x * 6).toFixed(2)}deg) rotateX(${(6 - y * 4).toFixed(2)}deg)`;
    };
    window.addEventListener("pointermove", mover);
    return () => window.removeEventListener("pointermove", mover);
  }, []);
  return ref;
}

export function CenaPainel() {
  const sobra = useContador(SOBRA);
  const inclina = useInclina();
  const max = Math.max(...MESES.map((m) => m.valor));

  return (
    <div className="entrada-cena relative" aria-hidden>
      <div ref={inclina} className="entrada-giro">
        <div className="entrada-sobe rounded-[22px] bg-white ring-1 ring-[#e3e8e2] shadow-[0_60px_120px_-40px_rgba(23,102,63,0.45),0_2px_6px_rgba(22,27,24,0.06)] overflow-hidden">
          {/* barra do app */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[#eceee9] bg-[#fafbf9]">
            <SimboloMarca className="w-4 h-4" />
            <span className="text-[13px] font-semibold text-[#161b18]">WiseFlow</span>
            <span className="ml-auto text-[12px] text-[#5f6861] rounded-full ring-1 ring-[#e3e8e2] px-2.5 py-0.5">novembro 2026</span>
          </div>

          <div className="p-5">
            <p className="text-[18px] font-semibold tracking-tight text-[#161b18]">Painel do mês</p>
            <p className="text-[12px] text-[#5f6861] mt-0.5 mb-4">O que ainda falta entrar e sair até o fim de novembro.</p>

            {/* a conta */}
            <div className="grid grid-cols-[1fr_1.15fr] rounded-2xl ring-1 ring-[#e3e8e2] overflow-hidden">
              <div className="bg-[#eef5f1] p-4 flex flex-col justify-between gap-3 border-r border-[#e3e8e2]">
                <p className="text-[11.5px] text-[#4a524c]">Sobra prevista no fim de novembro</p>
                <p className="valor text-[34px] font-semibold tracking-tight leading-none text-[#161b18]">{brl(sobra)}</p>
                <p className="text-[11px] text-[#5f6861]">Se tudo entrar e sair como está lançado.</p>
              </div>
              <dl className="p-2">
                {CONTA.map((l) => (
                  <div key={l.rotulo} className="grid grid-cols-[0.9rem_1fr_auto] items-baseline gap-x-1.5 px-2 py-2">
                    <span className="valor text-[13px] text-[#737c74]">{l.sinal}</span>
                    <dt className="text-[12px] text-[#363d38]">{l.rotulo}</dt>
                    <dd className="valor text-[12.5px] font-medium text-[#161b18]">{brl(l.valor)}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-[0.9rem_1fr_auto] items-baseline gap-x-1.5 px-2 pt-2 mt-1 border-t border-[#eceee9]">
                  <span className="valor text-[13px] text-[#737c74]">=</span>
                  <dt className="text-[12px] font-medium text-[#161b18]">Sobra</dt>
                  <dd className="valor text-[12.5px] font-semibold text-[#17663f]">{brl(SOBRA)}</dd>
                </div>
              </dl>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {/* próximos meses */}
              <div className="rounded-2xl ring-1 ring-[#e3e8e2] p-4">
                <p className="text-[12.5px] font-semibold text-[#161b18]">Os próximos meses</p>
                <p className="text-[11px] text-[#5f6861] mb-3">Quanto deve sobrar, somando mês a mês</p>
                <div className="flex items-end gap-2 h-[92px]">
                  {MESES.map((m, i) => (
                    <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div
                        className="entrada-barra w-full rounded-md"
                        style={{
                          height: `${(m.valor / max) * 100}%`,
                          background: i === 0 ? "#17663f" : "#a9d1ba",
                          animationDelay: `${0.7 + i * 0.08}s`,
                        }}
                      />
                      <span className="text-[10px] text-[#5f6861]">{m.mes}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* para onde vai */}
              <div className="rounded-2xl ring-1 ring-[#e3e8e2] p-4">
                <p className="text-[12.5px] font-semibold text-[#161b18]">Para onde vai o dinheiro</p>
                <p className="text-[11px] text-[#5f6861] mb-2.5">Contas e parcelas por categoria</p>
                <ul className="space-y-2">
                  {CATEGORIAS.map((c, i) => (
                    <li key={c.nome}>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#363d38]">{c.nome}</span>
                        <span className="valor text-[#161b18]">{brl(c.valor)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#eceee9] mt-1 overflow-hidden">
                        <div
                          className="entrada-trilho h-full rounded-full bg-[#1f7a52]"
                          style={{ width: `${(c.valor / CATEGORIAS[0].valor) * 100}%`, animationDelay: `${0.8 + i * 0.07}s` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* cartões soltos na frente */}
      <div className="entrada-flutua absolute -left-12 -bottom-8 rounded-2xl bg-white ring-1 ring-[#e3e8e2] shadow-[0_24px_48px_-24px_rgba(22,27,24,0.35)] px-4 py-3 w-[230px]">
        <p className="text-[11.5px] text-[#5f6861]">Vence sexta, 14/11</p>
        <div className="flex items-baseline justify-between mt-0.5">
          <p className="text-[14px] font-semibold text-[#161b18]">Conta de luz</p>
          <p className="valor text-[14px] font-semibold text-[#a23d28]">{brl(186.4)}</p>
        </div>
      </div>
      <div className="entrada-flutua-2 absolute -right-6 top-10 rounded-2xl bg-white ring-1 ring-[#e3e8e2] shadow-[0_24px_48px_-24px_rgba(22,27,24,0.35)] px-4 py-3">
        <p className="text-[11.5px] text-[#5f6861]">Financiamento do carro</p>
        <p className="text-[14px] font-semibold text-[#161b18] mt-0.5">Quitado 8 meses antes</p>
      </div>
    </div>
  );
}
