"use client";
import { Bell, Check, Camera } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  link?: string;
  thumb?: string;
  lida: boolean;
  criada_em: string;
}

export default function NotificacoesBell({ email }: { email?: string }) {
  const [notifs,  setNotifs]  = useState<Notificacao[]>([]);
  const [aberto,  setAberto]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const naoLidas = notifs.filter(n => !n.lida).length;

  const carregar = useCallback(async () => {
    if (!email) return;
    try {
      const url = `/api/notificacoes?email=${encodeURIComponent(email)}`;
      const res = await fetch(url);
      if (res.ok) setNotifs(await res.json());
    } catch {}
  }, [email]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 30_000);
    return () => clearInterval(timer);
  }, [carregar]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (aberto) { playSound("close"); setAberto(false); }
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  async function marcarTodasLidas() {
    if (!email) return;
    await fetch("/api/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, todas: true }),
    });
    setNotifs(ns => ns.map(n => ({ ...n, lida: true })));
  }

  async function marcarLida(id: string) {
    await fetch("/api/notificacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, lida: true } : n));
  }

  function tempo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(min  / 60);
    const d    = Math.floor(h    / 24);
    if (d  > 0) return `${d}d atrás`;
    if (h  > 0) return `${h}h atrás`;
    if (min > 0) return `${min}min atrás`;
    return "agora";
  }

  function toggleAberto() {
    const next = !aberto;
    playSound(next ? "open" : "close");
    setAberto(next);
    if (next) carregar();
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggleAberto}
        aria-label="Notificações"
        className={`tb-icon-btn relative p-2 rounded-xl transition-all duration-150
          ${aberto ? "is-active" : ""}`}>
        <Bell size={20} />
        {naoLidas > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#2E7DD1] text-white text-[10px] font-black flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="tb-notif-dropdown absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b tb-notif-header">
              <span className="font-bold text-sm">Notificações</span>
              {naoLidas > 0 && (
                <button onClick={marcarTodasLidas}
                  className="text-xs text-[#2E7DD1] font-semibold hover:underline flex items-center gap-1">
                  <Check size={11} /> Marcar todas lidas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Bell size={28} className="text-gray-300 mb-2 opacity-40" />
                  <p className="text-sm opacity-60">Sem notificações</p>
                  <p className="text-xs mt-1 opacity-40">Você será avisado quando aparecer em novas fotos</p>
                </div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    className={`tb-notif-row flex gap-3 px-4 py-3 border-b cursor-pointer transition ${!n.lida ? "is-unread" : ""}`}
                    onClick={() => { playSound("tap"); marcarLida(n.id); if (n.link) window.location.href = n.link; }}>

                    <div className="shrink-0">
                      {n.thumb
                        ? <img src={n.thumb} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-100" />
                        : <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                            <Camera size={16} className="text-white" />
                          </div>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.lida ? "font-bold" : "font-medium opacity-70"}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-1 opacity-50">{n.mensagem}</p>
                      <p className="text-[11px] mt-1 opacity-40">{tempo(n.criada_em)}</p>
                    </div>

                    {!n.lida && (
                      <div className="w-2 h-2 rounded-full bg-[#2E7DD1] shrink-0 mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
