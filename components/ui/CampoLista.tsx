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
      <label className={cn("block text-xs font-medium mb-1", alerta ? "text-amber-600" : "text-gray-500")}>
        {rotulo}
        {alerta && " · confere"}
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
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {opcoes.length > 0 && (
          <button
            onClick={() => { setLivre(false); aoMudar(opcoes[0]); }}
            className="px-2 text-xs text-gray-400 hover:text-gray-600"
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
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {!conhecido && <option value="">{placeholder}</option>}
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <button onClick={() => setLivre(true)} className="px-2 text-xs text-gray-400 hover:text-gray-600">
        nova
      </button>
    </div>
  );
}
