"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronRight, ChevronDown, ScanFace, Calendar, Images,
  Sparkles, ArrowRight, HelpCircle, ShieldCheck, Heart, Search,
} from "lucide-react";
import MinhasFotos from "@/app/components/MinhasFotos";
import { abrirInfoModal } from "@/app/components/InfoModais";
import { fetchMinhasFotos, ouvirAtualizacoes } from "@/lib/minhasFotos";
import { lerFavoritos } from "@/app/(public)/favoritos/page";
import { SkeletonEventos } from "@/app/components/Skeleton";
import MultiDayEventCard from "@/app/components/MultiDayEventCard";
import SingleEventCard from "@/app/components/SingleEventCard";
import type { EventoItem } from "@/app/api/eventos/route";

function slugify(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ── HERO com fade entre capas dos eventos ─────────────────── */
function Hero({ eventos }: { eventos: EventoItem[] }) {
  const [idx, setIdx] = useState(0);
  const comCapa = eventos.filter(e => e.capa_id).slice(0, 5);

  useEffect(() => {
    if (comCapa.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % comCapa.length), 6000);
    return () => clearInterval(t);
  }, [comCapa.length]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (comCapa.length > 0) setIdx(Math.floor(Math.random() * comCapa.length));
    }, 0);
    return () => window.clearTimeout(id);
  }, [comCapa.length]);

  function scrollProBaixo() {
    const target = window.innerHeight * 0.65;
    const start  = window.scrollY;
    const dur    = 900;
    const t0     = performance.now();
    function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function step(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      window.scrollTo(0, start + (target - start) * ease(p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  return (
    <section className="relative w-full overflow-hidden flex items-center"
      style={{ minHeight: "100vh", background: "linear-gradient(135deg,#020b18 0%,#0D2B4E 60%,#1A4A80 100%)" }}>

      {/* Layers de imagem (fade entre capas) */}
      {comCapa.map((ev, i) => (
        <div key={ev.id}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${i === idx ? "opacity-100" : "opacity-0"}`}>
          <img
            src={`/api/thumb?id=${ev.capa_id}&sz=1600`}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: "75% 25%" }}
            loading={i === idx ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Overlay gradiente esquerda→direita pra texto ficar legível
          pointer-events-none pra não bloquear o link da foto */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(6,18,55,0.96) 0%, rgba(6,18,55,0.88) 30%, rgba(6,18,55,0.55) 55%, rgba(6,18,55,0.15) 80%, transparent 100%)"
        }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(6,18,55,0.40) 0%, transparent 25%, transparent 70%, rgba(6,18,55,0.65) 100%)" }} />

      {/* Link invisível na metade direita: clicar na foto vai pro evento ativo */}
      {comCapa[idx] && (
        <>
          <Link
            href={`/eventos/${comCapa[idx].id}-${slugify(comCapa[idx].nome)}`}
            aria-label={`Ver evento ${comCapa[idx].nome}`}
            className="absolute top-0 bottom-0 right-0 left-1/2 z-[5]"
            title={`Ver ${comCapa[idx].nome}`}
          />
          {/* Pílula "Ver evento" — só desktop (mobile tem o CTA principal já com mesma ação) */}
          <Link
            href={`/eventos/${comCapa[idx].id}-${slugify(comCapa[idx].nome)}`}
            className="hidden sm:flex absolute top-1/2 right-6 -translate-y-1/2 z-[15] items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-bold backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-105 hover:bg-white/30"
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)" }}>
            <Calendar size={14} />
            Ver {comCapa[idx].nome.length > 24 ? comCapa[idx].nome.slice(0, 22) + "…" : comCapa[idx].nome}
            <ArrowRight size={14} />
          </Link>
        </>
      )}

      {/* Conteúdo — mobile compacto, desktop espaçoso */}
      <div className="relative z-10 w-full pl-4 sm:pl-5 pr-4 sm:pr-6 lg:pr-12">
        <div key={comCapa[idx]?.id ?? "static"} className="max-w-xl animate-fade-up">
          {comCapa[idx] ? (
            <>
              {/* Badge dinâmico — só data no mobile, data+fotos no desktop */}
              <div className="inline-flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <span className="flex items-center gap-1.5 text-white/90 text-[10px] sm:text-xs font-bold uppercase tracking-wide">
                  <Calendar size={11} className="text-[#5BA4E5]" />
                  {new Date(comCapa[idx].data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                {comCapa[idx].total_fotos > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="hidden sm:flex items-center gap-1.5 text-white/90 text-xs font-bold uppercase tracking-wide">
                      <Images size={11} className="text-[#5BA4E5]" />
                      {comCapa[idx].total_fotos} fotos
                    </span>
                    <span className="sm:hidden text-white/90 text-[10px] font-bold uppercase tracking-wide">
                      {comCapa[idx].total_fotos}f
                    </span>
                  </>
                )}
              </div>

              {/* Supratítulo só desktop */}
              <p className="hidden sm:block text-white/60 text-sm font-medium mb-2 uppercase tracking-widest">
                Suas fotos do evento
              </p>

              {/* Nome do evento — escala bem do mobile pro desktop */}
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white leading-[1.1] mb-4 sm:mb-5 line-clamp-3"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}>
                {comCapa[idx].nome}
              </h1>

              {/* Subtítulo só desktop — no mobile o evento já é claro */}
              <p className="hidden sm:block text-white/80 text-base lg:text-lg mb-9 leading-relaxed max-w-md">
                Cadastre seu rosto e nossa IA encontra você {" "}
                <span className="font-semibold" style={{ color: "#5BA4E5" }}>automaticamente</span>
                {" "}nas fotos deste evento.
              </p>

              {/* CTAs — coluna full-width no mobile, linha no desktop */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-6 sm:mb-10 max-w-sm sm:max-w-none">
                <Link href={`/eventos/${comCapa[idx].id}-${slugify(comCapa[idx].nome)}`}
                  className="flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-2xl font-bold text-white text-sm shadow-lg transition hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#2E7DD1,#1A4A80)", boxShadow: "0 8px 32px rgba(46,125,209,0.55)" }}>
                  <Images size={16} /> Ver fotos do evento
                </Link>
                <Link href="/cadastrar-rosto"
                  className="flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-2xl font-bold text-white text-sm transition hover:bg-white/20"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <ScanFace size={16} /> Cadastrar rosto
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Fallback: nenhum evento com capa — pitch genérico */}
              <div className="inline-flex items-center gap-2 mb-4 sm:mb-5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <Sparkles size={11} className="text-[#5BA4E5]" />
                <span className="text-white/90 text-[10px] sm:text-xs font-bold uppercase tracking-wide">IA com reconhecimento facial</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white leading-[1.1] mb-4 sm:mb-5"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}>
                Encontre suas fotos<br />
                <span style={{ color: "#5BA4E5" }}>automaticamente</span>
              </h1>

              <p className="hidden sm:block text-white/80 text-base lg:text-lg mb-9 leading-relaxed max-w-md">
                Cadastre seu rosto, deixa nossa IA buscar e te avisar quando suas fotos aparecerem.
              </p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-6 sm:mb-10 max-w-sm sm:max-w-none">
                <Link href="/cadastrar-rosto"
                  className="flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-2xl font-bold text-white text-sm shadow-lg transition hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#2E7DD1,#1A4A80)", boxShadow: "0 8px 32px rgba(46,125,209,0.55)" }}>
                  <ScanFace size={16} /> Cadastrar meu rosto
                </Link>
                <Link href="/eventos"
                  className="flex items-center justify-center sm:justify-start gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-2xl font-bold text-white text-sm transition hover:bg-white/20"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <Calendar size={16} /> Ver eventos
                </Link>
              </div>
            </>
          )}

          {/* Atalhos secundários — só desktop (mobile tem footer e modais via outras rotas) */}
          <div className="hidden sm:flex flex-wrap gap-2 text-white/60">
            <button
              onClick={() => abrirInfoModal("como-funciona")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:text-white hover:bg-white/10 transition">
              <HelpCircle size={12} /> Como funciona
            </button>
            <button
              onClick={() => abrirInfoModal("privacidade")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:text-white hover:bg-white/10 transition">
              <ShieldCheck size={12} /> Privacidade
            </button>
          </div>
        </div>
      </div>

      {/* Indicadores dos slides — canto inferior direito.
          Cada botão tem 28px de altura clicável (padding) mas a bolinha visual
          dentro tem só 8px. Assim funciona bem com mouse e dedo (mobile). */}
      {comCapa.length > 1 && (
        <div className="absolute bottom-2 right-3 z-30 flex items-center">
          {comCapa.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIdx(i);
              }}
              aria-label={`Ir pro slide ${i + 1}`}
              className="flex items-center justify-center cursor-pointer group"
              style={{ width: 28, height: 28 }}
            >
              <span
                className="block rounded-full transition-all duration-300 group-hover:bg-white"
                style={{
                  width:  i === idx ? 26 : 8,
                  height: 8,
                  background: i === idx ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Seta scroll-down animada */}
      <button onClick={scrollProBaixo}
        aria-label="Rolar para baixo"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 group">
        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Veja mais
        </span>
        <span className="w-10 h-10 rounded-full flex items-center justify-center animate-bounce group-hover:bg-white/20 transition"
          style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.22)" }}>
          <ChevronDown size={20} className="text-white/85" />
        </span>
      </button>
    </section>
  );
}

/* ── Painel compacto de stats (faixa única elegante) ──────── */
function StatsCard({ eventos, fotos, favoritas, nome }: { eventos: number; fotos: number; favoritas: number; nome?: string }) {
  if (eventos === 0 && fotos === 0 && favoritas === 0) return null;
  const items = [
    { href: "/minhas-fotos", icon: Images,   n: fotos,     label: "foto",     plural: "fotos",     color: "text-[#2E7DD1]"  },
    { href: "/eventos",      icon: Calendar, n: eventos,   label: "evento",   plural: "eventos",   color: "text-purple-600" },
    { href: "/favoritos",    icon: Heart,    n: favoritas, label: "favorita", plural: "favoritas", color: "text-red-500"    },
  ];
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {/* Coluna esquerda: saudação */}
        <div className="px-5 py-4 sm:py-3 sm:flex-1 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, rgba(46,125,209,0.06), rgba(91,164,229,0.02))" }}>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow">
            <Sparkles size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[#0D2B4E] font-bold text-sm truncate">
              {nome ? `Olá, ${nome.split(" ")[0]}!` : "Seu painel"}
            </p>
            <p className="text-gray-400 text-xs mt-0.5 truncate">Resumo da sua atividade</p>
          </div>
        </div>

        {/* Stats inline */}
        {items.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}
              className="px-5 py-3 flex items-center gap-3 hover:bg-[#F5F7FA] transition group sm:min-w-[150px]">
              <Icon size={18} className={`${s.color} group-hover:scale-110 transition`} fill={s.label === "favorita" ? "currentColor" : "none"} />
              <div>
                <p className="text-xl font-black text-[#0D2B4E] leading-none">{s.n}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mt-0.5">
                  {s.n === 1 ? s.label : s.plural}
                </p>
              </div>
              <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-[#2E7DD1] transition" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}


/* ── Bloco "Como funciona" resumido ──────────────────────── */
function ComoFuncionaResumo() {
  const passos = [
    { Icon: ScanFace, num: "1", titulo: "Cadastre seu rosto",  desc: "Selfie nítida + sua IA gera assinatura facial local." },
    { Icon: Search,   num: "2", titulo: "Admin indexa eventos", desc: "Após o evento, a IA encontra você nas fotos." },
    { Icon: Sparkles, num: "3", titulo: "Veja suas fotos",      desc: "Notificação chega e suas fotos aparecem em 'Minhas fotos'." },
  ];

  return (
    <section className="bg-white rounded-3xl shadow border border-gray-100 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#0D2B4E] flex items-center gap-2">
          <HelpCircle size={18} className="text-[#2E7DD1]" /> Como funciona
        </h2>
        <button onClick={() => abrirInfoModal("como-funciona")}
          className="text-[#2E7DD1] text-xs font-bold hover:underline flex items-center gap-1">
          Saiba mais <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {passos.map(p => {
          const Icon = p.Icon;
          return (
            <div key={p.num} className="text-center sm:text-left">
              <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                <span className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-black shrink-0">
                  {p.num}
                </span>
                <Icon size={16} className="text-[#2E7DD1]" />
              </div>
              <p className="font-bold text-[#0D2B4E] text-sm mb-1">{p.titulo}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{p.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Página ──────────────────────────────────────────────── */
export default function HomePage() {
  const { data: session } = useSession();
  const [eventos,  setEventos]  = useState<EventoItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState({ eventos: 0, fotos: 0, favoritas: 0 });

  // Email + nome derivados
  const [email, setEmail] = useState("");
  const [nome,  setNome]  = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setNome(session.user.name ?? "");
        return;
      }
      try {
        const u = JSON.parse(localStorage.getItem("usuario_simples") ?? "null");
        if (u?.email) { setEmail(u.email); setNome(u.nome ?? ""); }
      } catch {}
    }, 0);
    return () => window.clearTimeout(id);
  }, [session]);

  // Eventos
  useEffect(() => {
    fetch("/api/eventos", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((lista: EventoItem[]) => {
        if (!Array.isArray(lista)) return setEventos([]);
        // Mantém eventos abertos que tenham folder_id principal OU pelo menos um dia com folder
        const ativos = lista.filter(e =>
          e.status === "aberto" &&
          (e.folder_id || e.dias?.some(d => d.folder_id))
        );
        setEventos(ativos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Stats
  useEffect(() => {
    if (!email) return;
    async function carregarStats() {
      const fresh = await fetchMinhasFotos(email);
      const favs  = lerFavoritos();
      setStats({
        eventos:   fresh?.porEvento.length ?? 0,
        fotos:     fresh?.matches.length ?? 0,
        favoritas: favs.length,
      });
    }
    carregarStats();
    return ouvirAtualizacoes(carregarStats);
  }, [email]);

  return (
    <div>
      {/* HERO — empurra pra cima do topbar */}
      <div className="-mt-16 lg:-mt-20">
        <Hero eventos={eventos} />
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 space-y-8">

        {/* Painel de stats — só aparece se tiver dados */}
        <StatsCard eventos={stats.eventos} fotos={stats.fotos} favoritas={stats.favoritas} nome={nome} />

        {/* Banner "Acho que é você" (só pra quem tem rosto) */}
        <MinhasFotos />

        {/* EVENTOS RECENTES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#0D2B4E] flex items-center gap-2">
              <Calendar size={18} className="text-[#2E7DD1]" /> Eventos recentes
            </h2>
            <Link href="/eventos" className="flex items-center gap-1 text-[#2E7DD1] text-sm font-semibold hover:underline">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <SkeletonEventos count={4} />
          ) : eventos.length === 0 ? (
            <div className="h-48 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 text-sm shadow-sm">
              Nenhum evento disponível ainda
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {eventos.slice(0, 8).map(ev => {
                const isMultiDia = (ev.dias?.length ?? 0) > 1;
                if (isMultiDia) return <MultiDayEventCard key={ev.id} evento={ev} slug={ev.id} />;
                return <SingleEventCard key={ev.id} evento={ev} slug={ev.id} />;
              })}
            </div>
          )}
        </section>

        {/* COMO FUNCIONA — resumo com link pro modal */}
        <ComoFuncionaResumo />

        {/* CTA final pra quem ainda não cadastrou */}
        {!email && (
          <section className="rounded-3xl p-8 lg:p-12 text-center text-white shadow-xl relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#0D2B4E,#1A4A80,#2E7DD1)" }}>
            <div className="absolute inset-0 opacity-10"
              style={{ background: "radial-gradient(circle at 30% 50%, rgba(91,164,229,0.4) 0%, transparent 50%)" }} />
            <div className="relative z-10 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center mx-auto mb-5">
                <ScanFace size={26} className="text-white" />
              </div>
              <h3 className="text-2xl lg:text-3xl font-black mb-3">Comece agora</h3>
              <p className="text-white/75 text-sm mb-6">
                Cadastre seu rosto e receba notificação quando aparecer em fotos de eventos.
              </p>
              <Link href="/cadastrar-rosto"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-[#0D2B4E] font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition">
                <ScanFace size={16} /> Cadastrar meu rosto
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
