"use client";

import { useLancador } from "@/components/lancar/LancadorGlobal";

/** Tela vazia que convida a lançar, em vez de só dizer que não tem nada. */
export function Vazio({ texto, acao }: { texto: string; acao?: string }) {
  const { abrir } = useLancador();
  return (
    <div className="rounded-2xl border border-dashed border-tinta-300 px-6 py-12 text-center">
      <p className="text-sm text-tinta-600">{texto}</p>
      {acao && (
        <button onClick={abrir} className="mt-3 text-sm font-medium text-marca-700 hover:underline underline-offset-4">
          {acao}
        </button>
      )}
    </div>
  );
}
