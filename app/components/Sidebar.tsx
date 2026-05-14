"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Home, Calendar, ScanFace, Search, Heart,
  HelpCircle, MessageCircle,
} from "lucide-react";
import { abrirInfoModal } from "./InfoModais";

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

// "Como funciona" abre via modal (não é rota) — tratado separadamente abaixo
const navInfo: { href: string; label: string; icon: typeof Home }[] = [];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [logado,      setLogado]      = useState(false);
  const [notifCount,  setNotifCount]  = useState(0);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const lastPlay  = useRef(0);
  const unlocked  = useRef(false);

  useEffect(() => {
    const a = new Audio("/click.mp3");
    a.preload = "auto";
    a.volume  = 0.6;
    audioRef.current = a;

    // Desbloqueia na primeira interação do usuário na página
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
    ...navInfo,
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-30"
      style={{ background: "linear-gradient(180deg, #0D2B4E 0%, #1A4A80 100%)" }}>

      <div className="px-6 py-6 border-b border-white/10">
        <Image src="/logos/logo.png" alt="Contourline" width={160} height={44}
          className="brightness-0 invert" priority />
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isFav  = href === "/favoritos";
          const badge  = isFav && logado && notifCount > 0;
          return (
            <Link key={href} href={href} onMouseEnter={playHover}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${active
                  ? "bg-white/15 text-white border-l-4 border-[#5BA4E5] pl-2"
                  : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <span className="relative shrink-0">
                <Icon size={18} />
                {badge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full
                    text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}

        {/* Como funciona — abre modal (não é rota) */}
        <button
          type="button"
          onMouseEnter={playHover}
          onClick={() => abrirInfoModal("como-funciona")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
        >
          <HelpCircle size={18} className="shrink-0" />
          Como funciona
        </button>
      </nav>

      <div className="px-4 py-5 border-t border-white/10">
        <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #1A4A80, #2E7DD1)" }}>
            <MessageCircle size={15} className="text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-semibold">Dúvidas?</p>
            <p className="text-white/60 text-xs">Fale com a gente</p>
          </div>
        </div>
        <p className="text-white/30 text-xs mt-4 text-center">© 2025 Contourline</p>
      </div>
    </aside>
  );
}
