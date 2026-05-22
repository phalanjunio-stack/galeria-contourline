"use client";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, Scan, User, Check, Camera } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { playSound } from "@/lib/sounds";

const COLLAPSED_KEY   = "galeria-sidebar-collapsed";
const COLLAPSED_EVENT = "galeria-sidebar-collapsed-changed";
const SIDEBAR_OPEN_PX   = 240;
const SIDEBAR_CLOSED_PX = 68;

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  link?: string;
  thumb?: string;
  lida: boolean;
  criada_em: string;
}

function SinhoNotif({ email }: { email?: string }) {
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
        className={`tb-icon-btn relative p-2 rounded-xl transition-all duration-150
          ${aberto ? "is-active" : ""}`}>
        <Bell size={20} />
        {naoLidas > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[10px] font-black flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#2E7DD1,#1A4A80)" }}>
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
            className="tb-notif-dropdown absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl z-50 overflow-hidden"
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
                      <div className="w-2 h-2 rounded-full bg-[#2E7DD1] shrink-0 mt-2 shadow-[0_0_6px_rgba(46,125,209,0.5)]" />
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

export default function Topbar() {
  const { data: session } = useSession();
  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);
  const [fotoSimples,    setFotoSimples]    = useState<string | null>(null);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [collapsed,      setCollapsed]      = useState(false);

  function carregarLocalStorage() {
    try {
      const raw = localStorage.getItem("usuario_simples");
      if (raw) setUsuarioSimples(JSON.parse(raw));
      const foto = localStorage.getItem("foto_perfil_thumb");
      if (foto) setFotoSimples(foto);
    } catch {}
  }

  useEffect(() => {
    carregarLocalStorage();
    window.addEventListener("profile-updated", carregarLocalStorage);
    return () => window.removeEventListener("profile-updated", carregarLocalStorage);
  }, []);

  // Escuta colapso da sidebar pra ajustar 'left'
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1"); } catch {}
    function onCustom(e: Event) {
      const ev = e as CustomEvent<{ collapsed: boolean }>;
      setCollapsed(!!ev.detail?.collapsed);
    }
    window.addEventListener(COLLAPSED_EVENT, onCustom as EventListener);
    return () => window.removeEventListener(COLLAPSED_EVENT, onCustom as EventListener);
  }, []);

  const emailNotif     = session?.user?.email ?? usuarioSimples?.email;
  const nomeSimples    = usuarioSimples?.nome ?? "";
  const inicialSimples = nomeSimples.trim()[0]?.toUpperCase() ?? "?";

  // Em telas <lg, left=0; em lg+, left = largura atual da sidebar
  const lgLeft = collapsed ? SIDEBAR_CLOSED_PX : SIDEBAR_OPEN_PX;

  return (
    <header
      className="topbar-shell fixed top-0 right-0 left-0 z-20"
      style={{
        // Custom property pra media query pegar
        ["--tb-lg-left" as never]: `${lgLeft}px`,
        transition: "left 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">

        <Link href="/" className="flex items-center lg:hidden">
          <Image src="/logos/logo.png" alt="Contourline" width={120} height={32} priority />
        </Link>

        {/* Busca */}
        <div className="hidden lg:flex w-80 relative">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200
            ${searchFocused ? "text-[#2E7DD1]" : "tb-search-icon"}`} />
          <input
            type="text"
            placeholder="Buscar fotos, eventos ou pessoas..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`tb-search-input w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm
              focus:outline-none transition-all duration-200
              ${searchFocused ? "is-focused" : ""}`}
          />
        </div>

        <div className="flex-1" />

        <Link href="/buscar-pessoa"
          className="tb-facial-btn hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
            whitespace-nowrap transition-all duration-200"
          onMouseEnter={() => playSound("tap")}>
          <Scan size={15} /> Busca por reconhecimento facial
        </Link>

        <div className="flex-1 lg:hidden" />

        <div className="flex items-center gap-1.5 lg:mr-8">
          <ThemeToggle />
          <SinhoNotif email={emailNotif} />

          {session?.user ? (
            <Link href="/perfil" className="flex items-center gap-2 pl-1" title={session.user.name ?? ""}>
              {session.user.image
                ? <Image src={session.user.image} alt={session.user.name ?? ""} width={34} height={34}
                    className="rounded-full border-2 border-[#2E7DD1] object-cover
                      hover:shadow-[0_0_10px_rgba(46,125,209,0.35)] transition-shadow" unoptimized />
                : <div className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1] flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
                    {session.user.name?.[0]?.toUpperCase() ?? <User size={16} />}
                  </div>
              }
            </Link>
          ) : usuarioSimples ? (
            <Link href="/perfil" className="flex items-center gap-2 pl-1" title={nomeSimples}>
              {fotoSimples
                ? <img src={fotoSimples} alt={nomeSimples}
                    className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1]/60 object-cover
                      hover:shadow-[0_0_10px_rgba(46,125,209,0.35)] transition-shadow" />
                : <div className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1]/60 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#2E7DD1,#5BA4E5)" }}>
                    {inicialSimples}
                  </div>
              }
            </Link>
          ) : (
            <Link href="/cadastrar-rosto"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white ml-1
                hover:shadow-[0_0_12px_rgba(46,125,209,0.35)] transition-shadow"
              style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
              <User size={14} /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
