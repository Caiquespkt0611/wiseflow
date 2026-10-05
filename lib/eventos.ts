"use client";

import { useEffect } from "react";

/**
 * O Lançador abre por cima de qualquer tela. Quando ele grava, a tela de baixo
 * precisa buscar de novo, senão o lançamento só aparece depois de recarregar.
 */
const EVENTO = "wiseflow:lancado";

export function avisarLancamento() {
  window.dispatchEvent(new Event(EVENTO));
}

export function useAoLancar(recarregar: () => void) {
  useEffect(() => {
    window.addEventListener(EVENTO, recarregar);
    return () => window.removeEventListener(EVENTO, recarregar);
  }, [recarregar]);
}
