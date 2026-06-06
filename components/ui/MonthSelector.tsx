"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MonthSelector({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const now = new Date();
  const isCurrentMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
      <button
        onClick={() => onChange(subMonths(date, 1))}
        className="p-1.5 hover:bg-white rounded-lg transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>
      <span className="text-sm font-medium text-gray-700 capitalize px-2 min-w-[160px] text-center">
        {label}
      </span>
      <button
        onClick={() => onChange(addMonths(date, 1))}
        className="p-1.5 hover:bg-white rounded-lg transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
      {!isCurrentMonth && (
        <button
          onClick={() => onChange(new Date())}
          className="ml-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 hover:bg-emerald-50 rounded-lg transition-colors"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
