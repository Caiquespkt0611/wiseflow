"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarCheck,
  ArrowDownToLine,
  Repeat,
  CreditCard,
  LineChart,
  LogOut,
  Landmark,
  Bell,
  ScanLine,
  Plus,
  MoreHorizontal,
  X,
  Route,
  Scissors,
  HandCoins,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useLancador } from "@/components/lancar/LancadorGlobal";
import { Marca } from "@/components/ui/Marca";
import type { Alerta } from "@/app/api/alertas/route";

const grupos = [
  {
    titulo: null,
    itens: [
      { href: "/dashboard", label: "Painel do mês", icon: LayoutDashboard },
      { href: "/projecao", label: "Projeção", icon: LineChart },
    ],
  },
  {
    titulo: "Entradas",
    itens: [
      { href: "/receitas", label: "Receitas fixas", icon: CalendarCheck },
      { href: "/receitas-variaveis", label: "Receitas parceladas", icon: ArrowDownToLine },
    ],
  },
  {
    titulo: "Saídas",
    itens: [
      { href: "/despesas-fixas", label: "Contas do mês", icon: Repeat },
      { href: "/despesas-variaveis", label: "Cartões e parcelas", icon: CreditCard },
      { href: "/emprestimos", label: "Empréstimos", icon: HandCoins },
    ],
  },
  {
    titulo: "Planejamento",
    itens: [
      { href: "/quitacao", label: "Quitar empréstimos", icon: Route },
      { href: "/economizar", label: "Onde economizar", icon: Scissors },
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      { href: "/fatura", label: "Importar fatura", icon: ScanLine },
      { href: "/contas", label: "Saldos das contas", icon: Landmark },
    ],
  },
];

const abas = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/projecao", label: "Projeção", icon: LineChart },
  { href: "/despesas-variaveis", label: "Cartões", icon: CreditCard },
];

function diasLabel(dias: number): { label: string; classe: string } {
  if (dias < 0) return { label: `${Math.abs(dias)}d atrasado`, classe: "text-saida-700 bg-saida-50" };
  if (dias === 0) return { label: "Hoje", classe: "text-aviso-800 bg-aviso-100" };
  if (dias === 1) return { label: "Amanhã", classe: "text-aviso-700 bg-aviso-50" };
  return { label: `Em ${dias} dias`, classe: "text-tinta-600 bg-tinta-100" };
}

function AlertaItem({ alerta }: { alerta: Alerta }) {
  const isReceita = alerta.tipo === "receita" || alerta.tipo === "receita_variavel";
  const { label, classe } = diasLabel(alerta.diasAteVencimento);

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-tinta-900 truncate">{alerta.descricao}</p>
        <p className="text-xs text-tinta-500 truncate">
          {alerta.extra ? `${alerta.extra}, ` : ""}dia {alerta.diaVencimento}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={cn("valor text-sm font-medium", isReceita ? "text-marca-700" : "text-tinta-900")}>
          {isReceita ? "+" : "−"}
          {formatCurrency(alerta.valor)}
        </p>
        <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-md", classe)}>{label}</span>
      </div>
    </div>
  );
}

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const { abrir } = useLancador();
  const [maisAberto, setMaisAberto] = useState(false);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => {
    fetch("/api/alertas")
      .then((r) => (r.ok ? r.json() : { alertas: [] }))
      .then((d) => setAlertas(d.alertas ?? []));
  }, [pathname]);

  useEffect(() => setMaisAberto(false), [pathname]);

  const urgentes = alertas.filter((a) => a.diasAteVencimento <= 0).length;
  const totalCount = alertas.length;

  const Sino = ({ className }: { className?: string }) => (
    <button
      onClick={() => setAlertasOpen((v) => !v)}
      aria-label={`Vencimentos próximos: ${totalCount}`}
      className={cn("relative p-2 rounded-lg transition-colors", alertasOpen ? "bg-tinta-100" : "hover:bg-tinta-100", className)}
    >
      <Bell className="w-5 h-5 text-tinta-600" />
      {totalCount > 0 && (
        <span
          className={cn(
            "absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center",
            urgentes > 0 ? "bg-saida-500" : "bg-aviso-500"
          )}
        >
          {totalCount}
        </span>
      )}
    </button>
  );

  const Navegacao = () => (
    <nav className="flex-1 px-3 pb-3 overflow-y-auto">
      {grupos.map((g) => (
        <div key={g.titulo ?? "inicio"} className="mt-4 first:mt-1">
          {g.titulo && <p className="px-3 mb-1 text-xs font-medium text-tinta-400">{g.titulo}</p>}
          {g.itens.map(({ href, label, icon: Icon }) => {
            const ativo = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors",
                  ativo ? "bg-superficie text-tinta-900 font-medium shadow-sm ring-1 ring-tinta-200" : "text-tinta-600 hover:text-tinta-900 hover:bg-tinta-100"
                )}
              >
                <Icon className={cn("w-[18px] h-[18px] flex-shrink-0", ativo ? "text-marca-600" : "text-tinta-400")} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const Rodape = () => (
    <div className="px-3 py-3 border-t border-tinta-200 flex items-center justify-between gap-2">
      <span className="px-3 text-sm text-tinta-600 truncate">{userName}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="Sair"
        title="Sair"
        className="p-2 rounded-lg text-tinta-500 hover:bg-saida-50 hover:text-saida-600 transition-colors"
      >
        <LogOut className="w-[18px] h-[18px]" />
      </button>
    </div>
  );

  return (
    <>
      {/* Computador: barra lateral */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-20 h-full w-64 bg-tinta-50 border-r border-tinta-200 flex-col">
        <div className="flex items-center justify-between px-5 h-16 flex-shrink-0">
          <Marca href="/dashboard" />
          <div className="relative">
            <Sino />
            {alertasOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAlertasOpen(false)} />
                <div className="absolute left-0 top-11 z-20 w-80 bg-superficie rounded-2xl shadow-xl ring-1 ring-tinta-200 overflow-hidden animate-abre-modal origin-top-left">
                  <AlertasPanel alertas={alertas} onClose={() => setAlertasOpen(false)} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={abrir}
            className="w-full flex items-center gap-2 pl-3 pr-2 py-2.5 rounded-xl bg-marca hover:bg-marca-forte text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-[18px] h-[18px]" />
            Lançar
            <kbd className="ml-auto text-[11px] font-medium bg-white/15 rounded px-1.5 py-0.5">N</kbd>
          </button>
        </div>

        <Navegacao />
        <Rodape />
      </aside>

      {/* Celular: barra de cima, só marca e vencimentos */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-tinta-50/90 backdrop-blur border-b border-tinta-200">
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="flex items-center justify-between px-4 h-14">
          <Marca href="/dashboard" />
          <Sino />
        </div>
      </header>

      {alertasOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/45 animate-fundo-in" onClick={() => setAlertasOpen(false)}>
          <div
            className="absolute left-2 right-2 bg-superficie rounded-2xl shadow-xl max-h-[70dvh] overflow-y-auto animate-abre-modal"
            style={{ top: "calc(3.75rem + env(safe-area-inset-top, 0px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <AlertasPanel alertas={alertas} onClose={() => setAlertasOpen(false)} />
          </div>
        </div>
      )}

      {/* Celular: abas de baixo, com o Lançar no meio */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-superficie/95 backdrop-blur border-t border-tinta-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 items-end h-16">
          {abas.slice(0, 2).map((a) => (
            <Aba key={a.href} {...a} ativo={pathname === a.href} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={abrir}
              aria-label="Lançar"
              className="-mt-5 w-14 h-14 rounded-2xl bg-marca text-white shadow-lg shadow-marca-700/25 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-7 h-7" />
            </button>
          </div>
          <Aba {...abas[2]} ativo={pathname === abas[2].href} />
          <button
            onClick={() => setMaisAberto(true)}
            className={cn("flex flex-col items-center justify-center gap-1 h-full text-[11px]", maisAberto ? "text-tinta-900" : "text-tinta-500")}
          >
            <MoreHorizontal className="w-5 h-5" />
            Mais
          </button>
        </div>
      </nav>

      {maisAberto && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/45 animate-fundo-in" onClick={() => setMaisAberto(false)} />
          <div className="relative w-full bg-tinta-50 rounded-t-3xl animate-sobe-folha flex flex-col max-h-[85dvh]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <span className="text-lg font-semibold text-tinta-900">Menu</span>
              <button onClick={() => setMaisAberto(false)} aria-label="Fechar" className="p-2 -mr-2 text-tinta-500 rounded-lg hover:bg-tinta-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Navegacao />
            <Rodape />
          </div>
        </div>
      )}
    </>
  );
}

function Aba({ href, label, icon: Icon, ativo }: { href: string; label: string; icon: typeof LayoutDashboard; ativo: boolean }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-1 h-full text-[11px]", ativo ? "text-marca-700 font-medium" : "text-tinta-500")}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}

function AlertasPanel({ alertas, onClose }: { alertas: Alerta[]; onClose: () => void }) {
  const receitas = alertas.filter((a) => a.tipo === "receita" || a.tipo === "receita_variavel");
  const despesas = alertas.filter((a) => a.tipo === "despesa_fixa" || a.tipo === "despesa_variavel" || a.tipo === "emprestimo");

  return (
    <>
      <div className="flex items-center justify-between pl-4 pr-2 py-2.5 border-b border-tinta-100">
        <span className="text-sm font-semibold text-tinta-900">Vencem nos próximos dias</span>
        <button onClick={onClose} aria-label="Fechar" className="p-1.5 hover:bg-tinta-100 rounded-lg">
          <X className="w-4 h-4 text-tinta-400" />
        </button>
      </div>

      {alertas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-tinta-500">Nada vence entre anteontem e daqui a 5 dias.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {receitas.length > 0 && (
            <>
              <p className="px-4 pt-3 text-xs font-medium text-marca-700">A receber</p>
              <div className="divide-y divide-tinta-100">
                {receitas.map((a) => <AlertaItem key={a.id + a.tipo} alerta={a} />)}
              </div>
            </>
          )}
          {despesas.length > 0 && (
            <>
              <p className="px-4 pt-3 text-xs font-medium text-saida-600">A pagar</p>
              <div className="divide-y divide-tinta-100">
                {despesas.map((a) => <AlertaItem key={a.id + a.tipo} alerta={a} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
