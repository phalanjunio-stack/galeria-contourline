import Image from "next/image";
import { signIn } from "@/auth";
import { ShieldCheck, KeyRound } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/admin";

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-[#040e1f]">

      {/* Logo Contourline gigante no fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <Image
          src="/logos/logo.png"
          alt=""
          width={700}
          height={200}
          className="opacity-[0.04] brightness-200 w-[80vw] max-w-3xl"
          aria-hidden
          priority
        />
      </div>

      {/* Gradiente radial azul no centro */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(46,125,209,0.25)_0%,transparent_70%)]" />

      {/* Brilhos de canto */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#1A4A80]/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2E7DD1]/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      {/* Card glassmorphism com vidro craquelado */}
      <div className="relative w-full max-w-sm z-10">

        {/* Camada de crack SVG — efeito vidro trincado */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <svg className="absolute inset-0 w-full h-full opacity-[0.18]" viewBox="0 0 400 500" preserveAspectRatio="none">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g stroke="#7ec8ff" strokeWidth="0.8" fill="none" filter="url(#glow)">
              {/* Trincas principais */}
              <polyline points="120,0 145,60 110,95 160,140 130,200"/>
              <polyline points="300,0 270,45 310,90 280,160 320,220"/>
              <polyline points="0,150 55,170 40,230 90,260"/>
              <polyline points="400,100 350,130 370,190 330,240"/>
              <polyline points="180,500 200,420 170,370 220,310 190,250"/>
              <polyline points="60,500 80,440 50,380 100,330"/>
              <polyline points="350,500 320,430 360,360 310,290"/>
              {/* Micro-trincas */}
              <polyline points="145,60 180,50 200,80"/>
              <polyline points="110,95 80,115 60,100"/>
              <polyline points="160,140 190,120 210,150"/>
              <polyline points="270,45 240,70 260,100"/>
              <polyline points="310,90 340,110 320,140"/>
              <polyline points="55,170 30,190 50,220"/>
              <polyline points="200,420 230,400 250,430"/>
              <polyline points="170,370 140,350 150,320"/>
              <polyline points="220,310 250,300 260,330"/>
              <polyline points="80,440 110,420 100,390"/>
              <polyline points="320,430 300,400 330,375"/>
            </g>
            {/* Pontos de impacto brilhantes */}
            <g fill="#a8d8ff" opacity="0.6">
              <circle cx="145" cy="60" r="2"/>
              <circle cx="110" cy="95" r="1.5"/>
              <circle cx="270" cy="45" r="2"/>
              <circle cx="310" cy="90" r="1.5"/>
              <circle cx="200" cy="250" r="2.5"/>
            </g>
          </svg>
        </div>

        {/* Card principal */}
        <div
          className="rounded-3xl p-8 text-center relative"
          style={{
            background: "rgba(13, 43, 78, 0.55)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            border: "1px solid rgba(91, 164, 229, 0.25)",
            boxShadow: "0 8px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src="/logos/logo.png" alt="Contourline" width={160} height={44} priority className="brightness-200" />
          </div>

          {/* Ícone */}
          <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck size={24} className="text-white" />
          </div>

          <h1 className="text-xl font-bold text-white mb-1">Acesso Administrativo</h1>
          <p className="text-white/40 text-sm mb-8">
            Entre com sua conta Google para acessar o painel.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: next });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-semibold text-sm transition shadow-lg text-white hover:bg-white/20"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z"/>
                <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.4-4.7 2.2-7.6 2.2-6.2 0-11.5-4.2-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
              </svg>
              Entrar com Google
            </button>
          </form>

          <p className="text-white/20 text-xs mt-6">
            Acesso restrito a administradores da Contourline
          </p>

          {/* Separador */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Login com senha local */}
          <form action={async (fd: FormData) => {
            "use server";
            await signIn("local", { password: fd.get("password"), redirectTo: next });
          }}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  name="password"
                  placeholder="Senha local"
                  className="w-full pl-9 pr-3 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#2E7DD1]/60"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              <button type="submit"
                className="px-4 py-3 rounded-xl gradient-primary text-white text-sm font-semibold shadow hover:opacity-90 transition">
                Entrar
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-white/30 text-sm hover:text-white/70 transition">
            ← Voltar à galeria
          </a>
        </div>
      </div>
    </div>
  );
}
