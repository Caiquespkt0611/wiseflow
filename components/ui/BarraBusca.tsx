"use client";

import { Search } from "lucide-react";
import type { SortState } from "./SortTh";

/** Busca e ordem numa linha só. Substitui os cabeçalhos de tabela clicáveis, que não cabem no celular. */
export function BarraBusca({
  valor,
  aoMudar,
  placeholder,
  sort,
  aoOrdenar,
  ordens,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  sort?: SortState;
  aoOrdenar?: (s: SortState) => void;
  ordens?: { rotulo: string; key: string; dir: "asc" | "desc" }[];
}) {
  const atual = sort ? `${sort.key}:${sort.dir}` : "";
  return (
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tinta-400" />
        <input
          type="search"
          placeholder={placeholder}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-superficie ring-1 ring-tinta-200 rounded-xl text-tinta-900 placeholder:text-tinta-400 focus:outline-none focus:ring-2 focus:ring-marca-500"
        />
      </div>
      {ordens && aoOrdenar && (
        <select
          aria-label="Ordenar"
          value={atual}
          onChange={(e) => {
            if (!e.target.value) return aoOrdenar(null);
            const [key, dir] = e.target.value.split(":");
            aoOrdenar({ key, dir: dir as "asc" | "desc" });
          }}
          className="flex-shrink-0 max-w-[44%] pl-3 pr-8 py-2.5 text-sm bg-superficie ring-1 ring-tinta-200 rounded-xl text-tinta-700 focus:outline-none focus:ring-2 focus:ring-marca-500"
        >
          <option value="">Ordem padrão</option>
          {ordens.map((o) => (
            <option key={`${o.key}:${o.dir}`} value={`${o.key}:${o.dir}`}>{o.rotulo}</option>
          ))}
        </select>
      )}
    </div>
  );
}
