"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  TrendingUp,
  LayoutDashboard,
  DollarSign,
  Coins,
  MinusCircle,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  Landmark,
  Bell,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  AlertCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Alerta } from "@/app/api/alertas/route";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/receitas", label: "Receitas Fixas", icon: DollarSign },
  { href: "/receitas-variaveis", label: "Receitas Variáveis", icon: Coins },
  { href: "/despesas-fixas", label: "Despesas Fixas", icon: MinusCircle },
  { href: "/despesas-variaveis", label: "Despesas Variáveis", icon: CreditCard },
  { href: "/contas", label: "Contas Bancárias", icon: Landmark },
  { href: "/projecao", label: "Projeção", icon: BarChart3 },
];

function diasLabel(dias: number): { label: string; color: string; bg: string } {
  if (dias < 0) return { label: `${Math.abs(dias)}d atraso`, color: "text-red-700", bg: "bg-red-100" };
  if (dias === 0) return { label: "Hoje", color: "text-orange-700", bg: "bg-orange-100" };
  if (dias === 1) return { label: "Amanhã", color: "text-orange-600", bg: "bg-orange-50" };
  return { label: `Em ${dias} dias`, color: "text-yellow-700", bg: "bg-yellow-100" };
}

function AlertaItem({ alerta }: { alerta: Alerta }) {
  const isReceita = alerta.tipo === "receita" || alerta.tipo === "receita_variavel";
  const { label, color, bg } = diasLabel(alerta.diasAteVencimento);

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 p-1 rounded-md ${isReceita ? "bg-emerald-50" : "bg-red-50"}`}>
            {isReceita
              ? <TrendingUpIcon className="w-3 h-3 text-emerald-600" />
              : <TrendingDown className="w-3 h-3 text-red-500" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{alerta.descricao}</p>
            {alerta.extra && <p className="text-xs text-gray-400 truncate">{alerta.extra}</p>}
            <p className="text-xs text-gray-500">{alerta.responsavel} · dia {alerta.diaVencimento}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-xs font-bold ${isReceita ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(alerta.valor)}
          </p>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${bg} ${color}`}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => {
    fetch("/api/alertas")
      .then((r) => r.ok ? r.json() : { alertas: [] })
      .then((d) => setAlertas(d.alertas ?? []));
  }, []);

  const urgentes = alertas.filter((a) => a.diasAteVencimento <= 0).length;
  const totalCount = alertas.length;

  const NavLinks = () => (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === href
              ? "bg-emerald-100 text-emerald-700"
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 flex flex-col">
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 text-white rounded-lg p-1.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900">WiseFlow</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAlertasOpen((v) => !v)}
              className="relative p-2"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {totalCount > 0 && (
                <span className={`absolute top-1 right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${urgentes > 0 ? "bg-red-500" : "bg-orange-400"}`}>
                  {totalCount}
                </span>
              )}
            </button>
            <button onClick={() => setOpen(!open)} className="p-2">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Alertas overlay (mobile) */}
      {alertasOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setAlertasOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-xl max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertasPanel alertas={alertas} onClose={() => setAlertasOpen(false)} />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-20 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className="flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 text-white rounded-lg p-1.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900">WiseFlow</span>
          </div>

          {/* Bell button (desktop) */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => setAlertasOpen((v) => !v)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                alertasOpen ? "bg-gray-100" : "hover:bg-gray-100"
              )}
              title="Alertas de vencimento"
            >
              <Bell className="w-4 h-4 text-gray-600" />
              {totalCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${urgentes > 0 ? "bg-red-500" : "bg-orange-400"}`}>
                  {totalCount}
                </span>
              )}
            </button>

            {/* Alertas dropdown (desktop) */}
            {alertasOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAlertasOpen(false)} />
                <div className="absolute left-0 top-9 z-20 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <AlertasPanel alertas={alertas} onClose={() => setAlertasOpen(false)} />
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-4 py-2 text-xs text-gray-500 truncate mb-1">{userName}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function AlertasPanel({ alertas, onClose }: { alertas: Alerta[]; onClose: () => void }) {
  const receitas = alertas.filter((a) => a.tipo === "receita" || a.tipo === "receita_variavel");
  const despesas = alertas.filter((a) => a.tipo === "despesa_fixa" || a.tipo === "despesa_variavel");

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">
            Alertas de vencimento
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {alertas.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-400">Nenhum vencimento nos próximos 5 dias</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {receitas.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-xs font-medium text-emerald-600 uppercase tracking-wide">
                A receber
              </p>
              {receitas.map((a) => <AlertaItem key={a.id + a.tipo} alerta={a} />)}
            </>
          )}
          {despesas.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-xs font-medium text-red-500 uppercase tracking-wide">
                A pagar
              </p>
              {despesas.map((a) => <AlertaItem key={a.id + a.tipo} alerta={a} />)}
            </>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400 text-center">
        Mostrando vencimentos de −2 a +5 dias a partir de hoje
      </div>
    </>
  );
}
