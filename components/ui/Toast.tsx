"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* No celular fica acima da barra de abas; no computador, canto de baixo. */}
      <div
        className="fixed z-[60] left-4 right-4 sm:left-auto sm:right-6 flex flex-col items-center sm:items-end gap-2 pointer-events-none bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl shadow-lg text-sm font-medium bg-tinta-900 text-tinta-50 pointer-events-auto animate-fade-in"
          >
            {t.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-marca-300" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0 text-saida-300" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
