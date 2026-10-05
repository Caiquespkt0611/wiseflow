"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Largura no computador. No celular é sempre uma folha de baixo, na largura toda. */
  largura?: "md" | "lg";
}

/**
 * Celular: folha que sobe de baixo, com o polegar alcançando os botões.
 * Computador: janela no centro. Esc fecha, a página de trás não rola.
 */
export function Modal({ title, onClose, children, largura = "md" }: ModalProps) {
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharRef.current();
    };
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45 animate-fundo-in" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-tinta-50 sm:bg-superficie shadow-2xl flex flex-col",
          "rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[88dvh]",
          "animate-sobe-folha sm:animate-abre-modal",
          largura === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-tinta-300" aria-hidden />
        <div className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-5 pb-3">
          <h2 className="text-lg font-semibold tracking-tight text-tinta-900">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 -mr-2 text-tinta-500 hover:bg-tinta-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
