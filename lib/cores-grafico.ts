"use client";

import { useEffect, useState } from "react";

/**
 * O Recharts recebe cor como texto, não como variável CSS. Este hook entrega a
 * cor certa para o modo claro ou escuro e troca junto quando o celular troca.
 * Entra x sai passaram no validador da skill dataviz nos dois modos (04/10/2026);
 * contas e cartões são dois tons do mesmo tijolo porque os dois são saída.
 */
const CLARO = {
  entra: "#2E8B61",
  contas: "#B84A33",
  cartoes: "#DE8E7B",
  saldo: "#17663F",
  simulado: "#976512",
  grade: "#E7E9E5",
  eixo: "#737C74",
};

const ESCURO = {
  entra: "#4FA77A",
  contas: "#D9654B",
  cartoes: "#8A4232",
  saldo: "#6CBE93",
  simulado: "#D9A646",
  grade: "#2A312C",
  eixo: "#8C968F",
};

export type CoresGrafico = typeof CLARO;

export function useCoresGrafico(): CoresGrafico {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setEscuro(mq.matches);
    const aoMudar = (e: MediaQueryListEvent) => setEscuro(e.matches);
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, []);
  return escuro ? ESCURO : CLARO;
}
