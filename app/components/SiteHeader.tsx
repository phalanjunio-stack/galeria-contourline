"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificacoesBell from "./NotificacoesBell";
import { abrirInfoModal } from "./InfoModais";

const navPublic = [
  { href: "/",              label: "Início" },
  { href: "/eventos",       label: "Eventos" },
  { href: "/minhas-fotos",  label: "Minhas fotos" },
  { href: "/buscar-pessoa", label: "Buscar por rosto" },
];

const navLogado = [
  { href: "/favoritos",     label: "Favoritos" },
];

/** Header público: fica transparente por cima do hero da home e sólido no resto. */
export default function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);
  const [fotoSimples,    setFotoSimples]    = useState<string | null>(null);
  const [scrolled,       setScrolled]       = useState(false);

  function carregarLocalStorage() {
    try {
      const raw = localStorage.getItem("usuario_simples");
      setUsuarioSimples(raw ? JSON.parse(raw) : null);
      setFotoSimples(localStorage.getItem("foto_perfil_thumb"));
    } catch {}
  }

  useEffect(() => {
    carregarLocalStorage();
    window.addEventListener("profile-updated", carregarLocalStorage);
    return () => window.removeEventListener("profile-updated", carregarLocalStorage);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const logado = !!session?.user || !!usuarioSimples;
  const navItems = [...navPublic, ...(logado ? navLogado : [])];
  const sobreHero = pathname === "/" && !scrolled;

  const emailNotif     = session?.user?.email ?? usuarioSimples?.email;
  const nomeSimples    = usuarioSimples?.nome ?? "";
  const inicialSimples = nomeSimples.trim()[0]?.toUpperCase() ?? "?";

  return (
    <header className={`site-header fixed inset-x-0 top-0 z-30 h-16 ${sobreHero ? "is-over-hero" : ""}`}>
      <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Contourline — início">
          <Image src="/logos/logo.png" alt="Contourline" width={132} height={36}
            className="site-logo h-auto w-[118px] lg:w-[132px]" priority />
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Principal">
          {navItems.map(({ href, label }) => {
            const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                aria-current={ativo ? "page" : undefined}
                className={`site-nav-link ${ativo ? "is-active" : ""}`}>
                {label}
              </Link>
            );
          })}
          <button type="button" onClick={() => abrirInfoModal("como-funciona")} className="site-nav-link">
            Como funciona
          </button>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificacoesBell email={emailNotif} />

          {session?.user ? (
            <Link href="/perfil" className="ml-1.5" title={session.user.name ?? ""}>
              {session.user.image
                ? <Image src={session.user.image} alt={session.user.name ?? ""} width={34} height={34}
                    className="site-avatar rounded-full object-cover" unoptimized />
                : <span className="site-avatar grid h-[34px] w-[34px] place-items-center rounded-full bg-[#2E7DD1] text-sm font-bold text-white">
                    {session.user.name?.[0]?.toUpperCase() ?? <User size={16} />}
                  </span>
              }
            </Link>
          ) : usuarioSimples ? (
            <Link href="/perfil" className="ml-1.5" title={nomeSimples}>
              {fotoSimples
                ? <img src={fotoSimples} alt={nomeSimples}
                    className="site-avatar h-[34px] w-[34px] rounded-full object-cover" />
                : <span className="site-avatar grid h-[34px] w-[34px] place-items-center rounded-full bg-[#2E7DD1] text-sm font-bold text-white">
                    {inicialSimples}
                  </span>
              }
            </Link>
          ) : (
            <Link href="/cadastrar-rosto" className="site-cta ml-2">
              <User size={15} /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
