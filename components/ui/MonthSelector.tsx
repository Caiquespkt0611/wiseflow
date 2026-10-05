"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MonthSelector({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const now = new Date();
  const isCurrentMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex items-center gap-2">
      {!isCurrentMonth && (
        <button
          onClick={() => onChange(new Date())}
          className="text-sm text-marca-700 font-medium px-3 py-2 hover:bg-marca-50 rounded-lg transition-colors"
        >
          Voltar para hoje
        </button>
      )}
      <div className="flex items-center rounded-xl bg-superficie ring-1 ring-tinta-200 p-1">
        <button
          onClick={() => onChange(subMonths(date, 1))}
          aria-label="Mês anterior"
          className="p-2 text-tinta-600 hover:bg-tinta-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-tinta-900 px-2 min-w-[148px] text-center first-letter:uppercase" aria-live="polite">
          {label}
        </span>
        <button
          onClick={() => onChange(addMonths(date, 1))}
          aria-label="Próximo mês"
          className="p-2 text-tinta-600 hover:bg-tinta-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
