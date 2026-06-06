"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortState = { key: string; dir: "asc" | "desc" } | null;

interface Props {
  label: string;
  col: string;
  sort: SortState;
  onSort: (col: string) => void;
}

export function SortTh({ label, col, sort, onSort }: Props) {
  const active = sort?.key === col;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none group"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1 hover:text-gray-700 transition-colors">
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-emerald-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-emerald-600" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
        )}
      </span>
    </th>
  );
}

export function nextSort(prev: SortState, col: string): SortState {
  if (prev?.key === col) {
    return { key: col, dir: prev.dir === "asc" ? "desc" : "asc" };
  }
  return { key: col, dir: "asc" };
}

export function sortList<T>(
  list: T[],
  sort: SortState,
  getters: Partial<Record<string, (item: T) => string | number>>
): T[] {
  if (!sort || !getters[sort.key]) return list;
  const get = getters[sort.key]!;
  return [...list].sort((a, b) => {
    const av = get(a), bv = get(b);
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return sort.dir === "asc" ? c : -c;
  });
}
