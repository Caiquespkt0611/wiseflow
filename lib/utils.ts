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
