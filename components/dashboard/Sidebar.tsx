"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  TrendingUp,
  LayoutDashboard,
  ArrowDownCircle,
  MinusCircle,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/receitas", label: "Receitas", icon: ArrowDownCircle },
  { href: "/despesas-fixas", label: "Despesas Fixas", icon: MinusCircle },
  { href: "/despesas-variaveis", label: "Despesas Variáveis", icon: CreditCard },
  { href: "/contas", label: "Contas Bancárias", icon: Landmark },
  { href: "/projecao", label: "Projeção", icon: BarChart3 },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <button onClick={() => setOpen(!open)} className="p-2">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/30"
          onClick={() => setOpen(false)}
        />
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
          className="flex items-center gap-2 px-4 h-14 border-b border-gray-200 flex-shrink-0"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="bg-emerald-500 text-white rounded-lg p-1.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="font-bold text-gray-900">WiseFlow</span>
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
