import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export function getMonthYear(date: Date): { month: number; year: number } {
  return { month: date.getMonth(), year: date.getFullYear() };
}

/**
 * Confirmar (receber/pagar) avança o vencimento um mês — data ou dataInicio — e,
 * nas parceladas por parcela, o ponteiro parcelaAtual. Então a parcela confirmada
 * é sempre a do mês ANTERIOR ao vencimento atual, e não a do mês em que se clicou.
 * Usar o mês de confirmadaAte fazia a parcela de setembro recebida em 4/out
 * esconder a parcela de outubro, que ainda vai entrar.
 */
export function confirmadaNoMes(
  vencimento: Date | string,
  confirmadaAte: Date | string | null | undefined,
  mes: number,
  ano: number
): boolean {
  if (!confirmadaAte) return false;
  const v = new Date(vencimento);
  const anterior = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() - 1, 1));
  return anterior.getUTCFullYear() === ano && anterior.getUTCMonth() + 1 === mes;
}
