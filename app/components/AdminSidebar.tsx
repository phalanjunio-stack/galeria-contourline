"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, Image as ImgIcon,
  HardDrive, Users, Settings, LogOut, ScanFace, Activity, Server,
} from "lucide-react";

const navItems = [
  { href: "/admin",                  label: "Dashboard",         icon: LayoutDashboard },
  { href: "/admin/eventos",          label: "Eventos",           icon: Calendar },
  { href: "/admin/fotos",            label: "Fotos",             icon: ImgIcon },
  { href: "/admin/drive",            label: "Google Drive",      icon: HardDrive },
  { href: "/admin/reconhecimento-servidor", label: "Reconhecimento IA", icon: ScanFace },
  { href: "/admin/usuarios",         label: "Usuários",          icon: Users },
  { href: "/admin/atividade",        label: "Atividade",         icon: Activity },
  { href: "/admin/sistema",          label: "Sistema",           icon: Server },
  { href: "/admin/config",           label: "Configurações",     icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    // Apaga o cookie de sessão e redireciona para login
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen gradient-sidebar fixed left-0 top-0 z-30">
      <div className="px-6 py-6 border-b border-white/10">
        <Image src="/logos/logo.png" alt="Contourline" width={150} height={40}
          className="brightness-0 invert" priority />
        <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
          Administrador
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active
                  ? "bg-white/15 text-white border-l-4 border-[#5BA4E5] pl-2"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-5 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/60 hover:text-white hover:bg-white/10 text-sm transition w-full px-3 py-2.5 rounded-xl"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </aside>
  );
}
