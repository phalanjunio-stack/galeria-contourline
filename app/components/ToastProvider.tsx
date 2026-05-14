"use client";
/**
 * Sistema de toasts global.
 * Uso: import { useToast } from "@/app/components/ToastProvider"
 *      const { toast } = useToast()
 *      toast({ titulo: "Rosto salvo!", mensagem: "Achamos você.", tipo: "sucesso", link: "/resultado" })
 */
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, X, ArrowRight } from "lucide-react";
import Link from "next/link";

export type ToastTipo = "sucesso" | "erro" | "info";

export interface ToastItem {
  id: string;
  titulo: string;
  mensagem?: string;
  tipo: ToastTipo;
  link?: string;
  linkLabel?: string;
  duracao?: number; // ms, default 5000
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const icons = {
    sucesso: <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />,
    erro:    <AlertCircle size={18} className="text-red-500    shrink-0 mt-0.5" />,
    info:    <Info        size={18} className="text-[#2E7DD1]  shrink-0 mt-0.5" />,
  };
  const borders = {
    sucesso: "border-emerald-200",
    erro:    "border-red-200",
    info:    "border-[#2E7DD1]/25",
  };

  return (
    <div className={`flex items-start gap-3 bg-white rounded-2xl border shadow-xl px-4 py-3 min-w-[240px] max-w-[320px] animate-slide-up ${borders[item.tipo]}`}
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.13)" }}>
      {icons[item.tipo]}
      <div className="flex-1 min-w-0">
        <p className="text-[#0D2B4E] font-bold text-sm leading-tight">{item.titulo}</p>
        {item.mensagem && (
          <p className="text-gray-400 text-xs mt-0.5 leading-snug">{item.mensagem}</p>
        )}
        {item.link && (
          <Link href={item.link} onClick={onClose}
            className="inline-flex items-center gap-1 text-[#2E7DD1] text-xs font-semibold mt-1.5 hover:underline">
            {item.linkLabel ?? "Ver agora"} <ArrowRight size={11} />
          </Link>
        )}
      </div>
      <button onClick={onClose}
        className="text-gray-300 hover:text-gray-500 transition shrink-0 -mt-0.5 -mr-1">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { duracao: 5000, ...opts, id };
    setToasts(prev => [...prev, item]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, item.duracao);
  }, []);

  function fechar(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Container: acima do botão ScrollToTop */}
      <div className="fixed bottom-44 right-4 lg:bottom-24 lg:right-6 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <ToastCard item={item} onClose={() => fechar(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
