"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Calendar, ScanFace, Search, Heart,
  HelpCircle, MessageCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { abrirInfoModal } from "./InfoModais";
import { playSound } from "@/lib/sounds";

const COLLAPSED_KEY = "galeria-sidebar-collapsed";

function getNotifCount() {
  try { return parseInt(localStorage.getItem("notif_novas_fotos") ?? "0"); } catch { return 0; }
}

const navPublic = [
  { href: "/",              label: "Início",           icon: Home },
  { href: "/eventos",       label: "Eventos",          icon: Calendar },
  { href: "/minhas-fotos",  label: "Minhas fotos",     icon: ScanFace },
  { href: "/buscar-pessoa", label: "Buscar por rosto", icon: Search },
];

const navLogado = [
  { href: "/favoritos",     label: "Favoritos",        icon: Heart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [logado,      setLogado]      = useState(false);
  const [notifCount,  setNotifCount]  = useState(0);
  const [collapsed,   setCollapsed]   = useState(false);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const lastPlay  = useRef(0);
  const unlocked  = useRef(false);

  // Persistir estado de colapso
  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    playSound(next ? "close" : "open");
    try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch {}
  }

  useEffect(() => {
    const a = new Audio("/click.mp3");
    a.preload = "auto";
    a.volume  = 0.6;
    audioRef.current = a;

    function unlock() {
      if (unlocked.current || !audioRef.current) return;
      audioRef.current.play()
        .then(() => { audioRef.current!.pause(); audioRef.current!.currentTime = 0; unlocked.current = true; })
        .catch(() => {});
    }
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  function playHover() {
    const now = Date.now();
    if (now - lastPlay.current < 120 || !audioRef.current) return;
    lastPlay.current = now;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }

  useEffect(() => {
    if (session?.user) { setLogado(true); return; }
    try {
      const raw = localStorage.getItem("usuario_simples");
      setLogado(!!raw);
    } catch { setLogado(false); }
  }, [session]);

  useEffect(() => {
    setNotifCount(getNotifCount());
    const handler = () => setNotifCount(getNotifCount());
    window.addEventListener("notif-update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("notif-update", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const navItems = [
    ...navPublic,
    ...(logado ? navLogado : []),
  ];

  return (
    <motion.aside
      className="hidden lg:flex flex-col min-h-screen fixed left-0 top-0 z-30 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0D2B4E 0%, #1A4A80 100%)" }}
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between shrink-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <Image src="/logos/logo.png" alt="Contourline" width={140} height={40}
                className="brightness-0 invert shrink-0" priority />
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
            <Image src="/logos/icon.png" alt="C" width={32} height={32}
              className="brightness-0 invert w-full h-full object-contain" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1 overflow-hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isFav  = href === "/favoritos";
          const badge  = isFav && logado && notifCount > 0;
          return (
            <div key={href} className="relative group/item">
              <Link href={href} onMouseEnter={playHover}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden
                  ${collapsed ? "justify-center" : ""}
                  ${active
                    ? "text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"}`}>

                {/* Glow ativo */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active-glow"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(46,125,209,0.30) 0%, rgba(91,164,229,0.15) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(91,164,229,0.3), 0 0 16px rgba(46,125,209,0.2)",
                    }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}

                {/* Barra esquerda ativa */}
                {active && !collapsed && (
                  <motion.div
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: "linear-gradient(to bottom, #5BA4E5, #2E7DD1)" }}
                  />
                )}

                <span className="relative shrink-0 z-10">
                  <Icon size={18} />
                  {badge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full
                      text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </span>

                {!collapsed && (
                  <span className="z-10 whitespace-nowrap">{label}</span>
                )}
              </Link>

              {/* Tooltip quando colapsado */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg
                  bg-[#0D2B4E] border border-white/20 text-white text-xs font-medium whitespace-nowrap
                  shadow-xl opacity-0 pointer-events-none
                  group-hover/item:opacity-100 transition-opacity duration-150 z-50">
                  {label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0D2B4E]" />
                </div>
              )}
            </div>
          );
        })}

        {/* Como funciona */}
        <div className="relative group/item">
          <button
            type="button"
            onMouseEnter={playHover}
            onClick={() => abrirInfoModal("como-funciona")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70
              hover:bg-white/10 hover:text-white transition-all duration-200 text-left
              ${collapsed ? "justify-center" : ""}`}
          >
            <HelpCircle size={18} className="shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Como funciona</span>}
          </button>
          {collapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg
              bg-[#0D2B4E] border border-white/20 text-white text-xs font-medium whitespace-nowrap
              shadow-xl opacity-0 pointer-events-none
              group-hover/item:opacity-100 transition-opacity duration-150 z-50">
              Como funciona
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0D2B4E]" />
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-white/10 rounded-xl p-3 mb-3"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #1A4A80, #2E7DD1)" }}>
              <MessageCircle size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Dúvidas?</p>
              <p className="text-white/60 text-xs">Fale com a gente</p>
            </div>
          </motion.div>
        )}

        {/* Botão colapsar */}
        <button
          onClick={toggleCollapsed}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/50
            hover:bg-white/10 hover:text-white/80 transition-all duration-200 text-xs
            ${collapsed ? "justify-center" : "justify-between"}`}
        >
          {!collapsed && <span>Recolher</span>}
          {collapsed
            ? <ChevronRight size={16} />
            : <ChevronLeft  size={16} />}
        </button>

        {!collapsed && (
          <p className="text-white/30 text-xs mt-2 text-center">© 2025 Contourline</p>
        )}
      </div>
    </motion.aside>
  );
}
