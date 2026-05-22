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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 gradient-navy border-t border-white/10">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isFav  = href === "/favoritos";
          const badge  = isFav && logado && notifCount > 0;
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-all
                ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}>
              <div className={`relative p-1.5 rounded-lg transition-all ${active ? "gradient-primary" : ""}`}>
                <Icon size={18} />
                {badge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full
                    text-white text-[8px] font-bold flex items-center justify-center leading-none">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
