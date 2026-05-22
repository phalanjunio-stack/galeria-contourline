"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, X, Undo2 } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
  duracao: number; // ms
  /** Se setado, mostra botão "Desfazer" e chama essa fn ao clicar */
  onUndo?: () => void;
}

interface ToastCtx {
  show: (msg: string, opts?: { type?: ToastType; duracao?: number; onUndo?: () => void }) => string;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa estar dentro do <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((msg: string, opts?: { type?: ToastType; duracao?: number; onUndo?: () => void }) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = {
      id, msg,
      type: opts?.type ?? "info",
      duracao: opts?.duracao ?? (opts?.onUndo ? 10000 : 3500),
      onUndo: opts?.onUndo,
    };
    setToasts(prev => [...prev, item]);
    return id;
  }, []);

  return (
    <Ctx.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => <ToastItemView key={t.id} toast={t} dismiss={dismiss} />)}
      </div>
    </Ctx.Provider>
  );
}

function ToastItemView({ toast, dismiss }: { toast: ToastItem; dismiss: (id: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.duracao);
    return () => clearTimeout(id);
  }, [toast.id, toast.duracao, dismiss]);

  const Icon = toast.type === "success" ? CheckCircle : toast.type === "error" ? AlertCircle : Info;
  const cores = toast.type === "success"
    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : toast.type === "error"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-white border-gray-200 text-[#0D2B4E]";
  const iconColor = toast.type === "success" ? "text-emerald-600"
    : toast.type === "error" ? "text-red-600"
    : "text-[#2E7DD1]";

  return (
    <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur min-w-[280px] max-w-md animate-slide-up ${cores}`}>
      <Icon size={18} className={`shrink-0 ${iconColor}`} />
      <span className="text-sm font-semibold flex-1">{toast.msg}</span>
      {toast.onUndo && (
        <button
          onClick={() => { toast.onUndo!(); dismiss(toast.id); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2E7DD1] text-white text-xs font-bold hover:bg-[#1A4A80] transition"
        >
          <Undo2 size={12} /> Desfazer
        </button>
      )}
      <button onClick={() => dismiss(toast.id)} className="text-gray-400 hover:text-gray-700 transition">
        <X size={14} />
      </button>
    </div>
  );
}
