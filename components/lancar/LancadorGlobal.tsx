"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Lancador } from "./Lancador";

const Contexto = createContext<{ abrir: () => void }>({ abrir: () => {} });

export const useLancador = () => useContext(Contexto);

/** Tecla N abre o Lançador de qualquer tela, menos quando a pessoa está digitando. */
function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function LancadorGlobal({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || digitando(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setAberto(true);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <Contexto.Provider value={{ abrir }}>
      {children}
      {aberto && (
        <Modal title="Lançar" onClose={fechar}>
          <Lancador autoFoco />
        </Modal>
      )}
    </Contexto.Provider>
  );
}
