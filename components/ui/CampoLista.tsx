"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Campo({
  rotulo,
  alerta,
  children,
}: {
  rotulo: string;
  alerta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={cn("block text-sm font-medium mb-1.5", alerta ? "text-aviso-700" : "text-tinta-700")}>
        {rotulo}
        {alerta && ", confere"}
      </label>
      {children}
    </div>
  );
}

/** Select das opções que já existem, com escape para digitar uma nova. */
export function ListaEditavel({
  valor,
  opcoes,
  aoMudar,
  placeholder,
}: {
  valor: string;
  opcoes: string[];
  aoMudar: (v: string) => void;
  placeholder: string;
}) {
  const conhecido = opcoes.includes(valor);
  const [livre, setLivre] = useState(!conhecido && valor !== "");

  if (livre || opcoes.length === 0) {
    return (
      <div className="flex gap-2">
        <input
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={placeholder}
          className="campo flex-1"
        />
        {opcoes.length > 0 && (
          <button
            onClick={() => { setLivre(false); aoMudar(opcoes[0]); }}
            className="px-2 text-xs text-tinta-400 hover:text-tinta-600"
          >
            lista
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={conhecido ? valor : ""}
        onChange={(e) => aoMudar(e.target.value)}
        className="campo flex-1"
      >
        {!conhecido && <option value="">{placeholder}</option>}
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <button onClick={() => setLivre(true)} className="px-2 text-xs text-tinta-400 hover:text-tinta-600">
        nova
      </button>
    </div>
  );
}
