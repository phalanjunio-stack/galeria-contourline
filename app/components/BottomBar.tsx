"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Home, Calendar, ScanFace, Search, Heart } from "lucide-react";

function getNotifCount() {
  try { return parseInt(localStorage.getItem("notif_novas_fotos") ?? "0"); } catch { return 0; }
}

const itemsPublic = [
  { href: "/",              label: "Início",       icon: Home },
  { href: "/eventos",       label: "Eventos",      icon: Calendar },
  { href: "/minhas-fotos",  label: "Minhas",       icon: ScanFace },
  { href: "/buscar-pessoa",   label: "Buscar",     icon: Search },
];

const itemLogado = { href: "/favoritos", label: "Favoritos", icon: Heart };

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [logado,     setLogado]     = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (session?.user) { setLogado(true); return; }
    try { setLogado(!!localStorage.getItem("usuario_simples")); }
    catch { setLogado(false); }
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

  const items = logado
    ? [...itemsPublic, itemLogado]
    : itemsPublic;

  return (
    <nav className="site-header lg:hidden fixed bottom-0 left-0 right-0 z-30 !border-b-0 border-t border-[var(--line)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around px-2 py-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isFav  = href === "/favoritos";
          const badge  = isFav && logado && notifCount > 0;
          return (
            <Link key={href} href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl min-w-[56px] transition-colors
                ${active ? "text-[var(--accent)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}>
              <div className={`relative px-3 py-1 rounded-full transition-colors ${active ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]" : ""}`}>
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                {badge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full
                    text-white text-[8px] font-bold flex items-center justify-center leading-none">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
