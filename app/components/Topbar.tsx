"use client";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, Scan, User, Check, Camera } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import ThemeToggle from "./ThemeToggle";

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
    const timer = setInterval(carregar, 30_000); // atualiza a cada 30s
    return () => clearInterval(timer);
  }, [carregar]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setAberto(v => !v); if (!aberto) carregar(); }}
        className="relative p-2 rounded-xl text-[#1A4A80] hover:bg-[#EFF5FF] transition">
        <Bell size={20} />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[10px] font-black flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#2E7DD1,#1A4A80)" }}>
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          style={{ background: "#fff" }}>

          {/* Header dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="font-bold text-[#0D2B4E] text-sm">Notificações</span>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas}
                className="text-xs text-[#2E7DD1] font-semibold hover:underline flex items-center gap-1">
                <Check size={11} /> Marcar todas lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell size={28} className="text-gray-200 mb-2" />
                <p className="text-gray-400 text-sm">Sem notificações</p>
                <p className="text-gray-300 text-xs mt-1">Você será avisado quando aparecer em novas fotos</p>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${!n.lida ? "bg-blue-50/40" : ""}`}
                  onClick={() => { marcarLida(n.id); if (n.link) window.location.href = n.link; }}>

                  {/* Thumb ou ícone */}
                  <div className="shrink-0">
                    {n.thumb
                      ? <img src={n.thumb} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-100" />
                      : <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                          <Camera size={16} className="text-white" />
                        </div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.lida ? "font-bold text-[#0D2B4E]" : "font-medium text-gray-600"}`}>
                      {n.titulo}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{n.mensagem}</p>
                    <p className="text-gray-300 text-[11px] mt-1">{tempo(n.criada_em)}</p>
                  </div>

                  {!n.lida && (
                    <div className="w-2 h-2 rounded-full bg-[#2E7DD1] shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Topbar() {
  const { data: session } = useSession();

  // Usuário simples (localStorage)
  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);
  const [fotoSimples,    setFotoSimples]    = useState<string | null>(null);

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
    // Escuta evento de atualização de perfil (disparado após salvar foto)
    window.addEventListener("profile-updated", carregarLocalStorage);
    return () => window.removeEventListener("profile-updated", carregarLocalStorage);
  }, []);

  const emailNotif     = session?.user?.email ?? usuarioSimples?.email;
  const nomeSimples    = usuarioSimples?.nome ?? "";
  const inicialSimples = nomeSimples.trim()[0]?.toUpperCase() ?? "?";

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-60 z-20"
      style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">

        {/* Mobile: logo */}
        <Link href="/" className="flex items-center lg:hidden">
          <Image src="/logos/logo.png" alt="Contourline" width={120} height={32} priority />
        </Link>

        {/* Desktop: busca — largura fixa para não empurrar itens da direita */}
        <div className="hidden lg:flex w-80 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar fotos, eventos ou pessoas..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0D2B4E] placeholder-gray-400 focus:outline-none focus:border-[#2E7DD1] transition"
            style={{ background: "#F5F7FA" }} />
        </div>

        {/* Empurra itens da direita para o canto com espaço */}
        <div className="flex-1" />

        {/* Botão facial (desktop) */}
        <Link href="/cadastrar-rosto"
          className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition hover:text-white"
          style={{ border: "1px solid rgba(46,125,209,0.3)", background: "#EFF5FF", color: "#1A4A80" }}>
          <Scan size={15} /> Busca por reconhecimento facial
        </Link>

        <div className="flex-1 lg:hidden" />

        {/* Ações — tema + bell + avatar */}
        <div className="flex items-center gap-1.5 lg:mr-8">
          <ThemeToggle />
          {/* Sininho com dropdown */}
          <SinhoNotif email={emailNotif} />

          {/* Avatar — Google, simples ou botão Entrar */}
          {session?.user ? (
            // Google
            <Link href="/perfil" className="flex items-center gap-2 pl-1" title={session.user.name ?? ""}>
              {session.user.image
                ? <Image src={session.user.image} alt={session.user.name ?? ""} width={34} height={34}
                    className="rounded-full border-2 border-[#2E7DD1] object-cover" unoptimized />
                : <div className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1] flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
                    {session.user.name?.[0]?.toUpperCase() ?? <User size={16} />}
                  </div>
              }
            </Link>
          ) : usuarioSimples ? (
            // Usuário simples — mostra foto se tiver, senão inicial
            <Link href="/perfil" className="flex items-center gap-2 pl-1" title={nomeSimples}>
              {fotoSimples
                ? <img src={fotoSimples} alt={nomeSimples}
                    className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1]/60 object-cover" />
                : <div className="w-[34px] h-[34px] rounded-full border-2 border-[#2E7DD1]/60 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#2E7DD1,#5BA4E5)" }}>
                    {inicialSimples}
                  </div>
              }
            </Link>
          ) : (
            // Não logado
            <Link href="/cadastrar-rosto"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white ml-1"
              style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
              <User size={14} /> Entrar
            </Link>
          )}
        </div>
      </div>

    </header>
  );
}
