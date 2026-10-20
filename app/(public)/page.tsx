"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronRight, ScanFace, Calendar, Images, MapPin,
  Sparkles, ArrowRight, Heart, Search, BellRing, ShieldCheck,
} from "lucide-react";
import MinhasFotos from "@/app/components/MinhasFotos";
import { abrirInfoModal } from "@/app/components/InfoModais";
import { fetchMinhasFotos, ouvirAtualizacoes } from "@/lib/minhasFotos";
import { lerFavoritos } from "@/app/(public)/favoritos/page";
import { SkeletonEventos } from "@/app/components/Skeleton";
import EventTile, { fmtPeriodo } from "@/app/components/EventTile";
import type { EventoItem } from "@/app/api/eventos/route";

function slugify(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const HERO_INTERVALO_MS = 6000;

/* ── HERO — capas dos eventos em destaque, com seletor ───── */
function Hero({ eventos, carregando }: { eventos: EventoItem[]; carregando: boolean }) {
  const [idx, setIdx] = useState(0);
  const comCapa = eventos.filter(e => e.capa_id).slice(0, 5);
  const atual = comCapa[idx];

  // Avança sozinho; trocar manualmente reinicia a contagem
  useEffect(() => {
    if (comCapa.length <= 1) return;
    const t = window.setTimeout(() => setIdx(i => (i + 1) % comCapa.length), HERO_INTERVALO_MS);
    return () => window.clearTimeout(t);
  }, [idx, comCapa.length]);

  const href = atual ? `/eventos/${atual.id}-${slugify(atual.nome)}` : "/eventos";
  const multiDia = (atual?.dias?.length ?? 0) > 1;

  return (
    <section className="relative -mt-16 flex h-[100svh] min-h-[600px] max-h-[960px] w-full overflow-hidden bg-[#06142A]">
      {comCapa.map((ev, i) => (
        <div key={ev.id}
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-in-out ${i === idx ? "opacity-100" : "opacity-0"}`}>
          <img
            src={`/api/thumb?id=${ev.capa_id}&sz=1600`}
            alt=""
            className={`h-full w-full object-cover ${i === idx ? "ken-burns" : ""}`}
            style={{ objectPosition: ev.capa_position ?? "center 30%" }}
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Overlays pra leitura do texto */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#06142A]/90 via-[#06142A]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06142A] via-[#06142A]/55 to-transparent sm:via-[#06142A]/20" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-end px-4 pb-36 sm:pb-32 lg:px-8 lg:pb-36">
        {atual ? (
          <div key={atual.id} className="max-w-2xl animate-fade-up">
            <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              <span className="h-px w-8 bg-white/50" /> Evento em destaque
            </p>
            <h1 className="font-display mb-4 line-clamp-3 text-4xl font-extrabold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              {atual.nome}
            </h1>
            <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={15} className="text-[#7DB9F0]" />
                {fmtPeriodo(atual.data, multiDia ? atual.data_fim : undefined)}
              </span>
              {atual.total_fotos > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Images size={15} className="text-[#7DB9F0]" /> {atual.total_fotos.toLocaleString("pt-BR")} fotos
                </span>
              )}
              {atual.local && (
                <span className="hidden items-center gap-1.5 capitalize sm:inline-flex">
                  <MapPin size={15} className="text-[#7DB9F0]" /> {atual.local.toLowerCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={href} className="btn-light">
                <Images size={17} /> Ver fotos do evento
              </Link>
              <Link href="/cadastrar-rosto" className="btn-glass">
                <ScanFace size={17} /> Encontrar minhas fotos
              </Link>
            </div>
          </div>
        ) : !carregando ? (
          <div className="max-w-2xl animate-fade-up">
            <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              <span className="h-px w-8 bg-white/50" /> Reconhecimento facial
            </p>
            <h1 className="font-display mb-5 text-4xl font-extrabold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
              Encontre suas fotos <span className="text-[#7DB9F0]">automaticamente</span>
            </h1>
            <p className="mb-8 max-w-md text-base text-white/75 sm:text-lg">
              Cadastre seu rosto e a nossa IA avisa quando você aparecer nas fotos dos eventos.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastrar-rosto" className="btn-light"><ScanFace size={17} /> Cadastrar meu rosto</Link>
              <Link href="/eventos" className="btn-glass"><Calendar size={17} /> Ver eventos</Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Seletor de destaques — miniaturas no desktop, pontos no mobile */}
      {comCapa.length > 1 && (
        <>
          <div className="absolute bottom-20 right-8 z-20 hidden gap-3 xl:flex">
            {comCapa.map((ev, i) => (
              <button key={ev.id} type="button" onClick={() => setIdx(i)}
                aria-label={`Destacar ${ev.nome}`}
                aria-current={i === idx}
                className={`group relative w-28 2xl:w-40 overflow-hidden rounded-xl text-left transition duration-300
                  ${i === idx ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}>
                <img src={`/api/thumb?id=${ev.capa_id}&sz=400`} alt="" loading="lazy"
                  className="aspect-[16/10] w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="absolute inset-x-2.5 bottom-2 line-clamp-1 text-xs font-semibold text-white">{ev.nome}</span>
                {i === idx && (
                  <span key={idx} className="hero-progress absolute inset-x-0 bottom-0 h-0.5 bg-white" />
                )}
              </button>
            ))}
          </div>

          <div className="absolute bottom-[88px] left-1/2 z-20 flex -translate-x-1/2 lg:bottom-8 xl:hidden">
            {comCapa.map((ev, i) => (
              <button key={ev.id} type="button" onClick={() => setIdx(i)}
                aria-label={`Ir pro destaque ${i + 1}`}
                className="flex h-7 w-7 items-center justify-center">
                <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ── Números da galeria (prova social) ─────────────────────── */
function Numeros({ eventos }: { eventos: EventoItem[] }) {
  if (eventos.length === 0) return null;
  const fotos   = eventos.reduce((s, e) => s + (e.total_fotos ?? 0), 0);
  const pessoas = eventos.reduce((s, e) => s + (e.pessoas_encontradas ?? 0), 0);
  const itens = [
    { n: eventos.length, label: eventos.length === 1 ? "evento publicado" : "eventos publicados" },
    { n: fotos,          label: "fotos na galeria" },
    ...(pessoas > 0 ? [{ n: pessoas, label: "pessoas encontradas pela IA" }] : []),
  ];

  return (
    <section className="relative z-10 -mt-10 rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] shadow-[0_24px_60px_-30px_rgba(11,31,58,0.45)]">
      <div className="grid sm:flex" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
        {itens.map((it, i) => (
          <div key={it.label} className={`px-3 py-4 sm:flex-1 sm:px-6 sm:py-5 ${i > 0 ? "border-l border-[var(--line)]" : ""}`}>
            <p className="font-display text-2xl font-extrabold text-[var(--ink)] tabular-nums sm:text-3xl">
              {it.n.toLocaleString("pt-BR")}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--ink-soft)] sm:text-sm">{it.label}</p>
          </div>
        ))}
        <div className="flex items-center border-t border-[var(--line)] px-4 py-4 sm:border-l sm:border-t-0 sm:px-6 sm:py-5"
          style={{ gridColumn: "1 / -1" }}>
          <Link href="/buscar-pessoa" className="btn-primary btn-sm w-full sm:w-auto">
            <Search size={15} /> Buscar por rosto
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Resumo pessoal (só pra quem já se identificou) ────────── */
function StatsCard({ eventos, fotos, favoritas, nome }: { eventos: number; fotos: number; favoritas: number; nome?: string }) {
  if (eventos === 0 && fotos === 0 && favoritas === 0) return null;
  const items = [
    { href: "/minhas-fotos", icon: Images,   n: fotos,     label: "foto",     plural: "fotos" },
    { href: "/eventos",      icon: Calendar, n: eventos,   label: "evento",   plural: "eventos" },
    { href: "/favoritos",    icon: Heart,    n: favoritas, label: "favorita", plural: "favoritas" },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2E7DD1] text-white">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-display truncate text-lg font-bold text-[var(--ink)]">
            {nome ? `Olá, ${nome.split(" ")[0]}!` : "Seu painel"}
          </p>
          <p className="text-sm text-[var(--ink-soft)]">Aqui está o que encontramos de você</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}
              className="group rounded-xl border border-[var(--line)] px-4 py-3 transition-colors hover:border-[var(--accent)]">
              <p className="flex items-center gap-1.5 font-display text-xl font-extrabold text-[var(--ink)]">
                {s.n}
                <Icon size={14} className="text-[var(--accent)]" fill={s.label === "favorita" ? "currentColor" : "none"} />
              </p>
              <p className="text-xs text-[var(--ink-soft)]">{s.n === 1 ? s.label : s.plural}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Cabeçalho de seção ───────────────────────────────────── */
function TituloSecao({ eyebrow, titulo, acao }: { eyebrow: string; titulo: string; acao?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{titulo}</h2>
      </div>
      {acao}
    </div>
  );
}

/* ── Como funciona ────────────────────────────────────────── */
function ComoFunciona() {
  const passos = [
    { Icon: ScanFace,  titulo: "Cadastre seu rosto",     desc: "Uma selfie basta. Ela serve só pra encontrar você nas fotos." },
    { Icon: Search,    titulo: "A IA procura por você",  desc: "Quando as fotos de um evento são publicadas, a IA marca onde você aparece." },
    { Icon: BellRing,  titulo: "Receba e baixe",         desc: "Você é avisado e vê tudo em “Minhas fotos”, pronto pra baixar." },
  ];

  return (
    <section>
      <TituloSecao
        eyebrow="Como funciona"
        titulo="Suas fotos em três passos"
        acao={
          <button onClick={() => abrirInfoModal("como-funciona")}
            className="hidden items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline sm:inline-flex">
            Saiba mais <ChevronRight size={15} />
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {passos.map(({ Icon, titulo, desc }, i) => (
          <div key={titulo} className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6">
            <span aria-hidden className="font-display pointer-events-none absolute right-5 top-4 select-none text-5xl font-extrabold leading-none text-[var(--ink)] opacity-[0.08]">
              {i + 1}
            </span>
            <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
              <Icon size={21} />
            </span>
            <p className="font-display mb-1.5 text-lg font-bold text-[var(--ink)]">{titulo}</p>
            <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-[var(--ink-soft)]">
        <ShieldCheck size={14} className="text-[var(--accent)]" />
        Sua selfie é usada apenas pra localizar suas imagens.
        <button onClick={() => abrirInfoModal("privacidade")} className="font-semibold text-[var(--accent)] hover:underline">
          Privacidade
        </button>
      </p>
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
      <Hero eventos={eventos} carregando={loading} />

      <div className="mx-auto max-w-7xl space-y-16 px-4 pb-20 lg:px-8">
        <Numeros eventos={eventos} />

        <StatsCard eventos={stats.eventos} fotos={stats.fotos} favoritas={stats.favoritas} nome={nome} />

        {/* Banner "Acho que é você" (só pra quem tem rosto) */}
        <MinhasFotos />

        {/* EVENTOS RECENTES */}
        <section>
          <TituloSecao
            eyebrow="Galeria"
            titulo="Eventos recentes"
            acao={
              <Link href="/eventos" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline">
                Ver todos <ArrowRight size={15} />
              </Link>
            }
          />

          {loading ? (
            <SkeletonEventos count={6} />
          ) : eventos.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] text-sm text-[var(--ink-soft)]">
              Nenhum evento disponível ainda
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {eventos.slice(0, 6).map(ev => <EventTile key={ev.id} evento={ev} slug={ev.id} />)}
            </div>
          )}
        </section>

        <ComoFunciona />

        {/* CTA final pra quem ainda não cadastrou */}
        {!email && (
          <section className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] px-6 py-12 text-center text-white sm:px-12 lg:py-16">
            <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#2E7DD1]/40 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#5BA4E5]/25 blur-3xl" />
            <div className="relative mx-auto max-w-xl">
              <h3 className="font-display mb-3 text-3xl font-extrabold lg:text-4xl">Suas fotos estão esperando</h3>
              <p className="mb-8 text-white/70">
                Cadastre seu rosto uma vez e receba um aviso sempre que aparecer nas fotos de um evento.
              </p>
              <Link href="/cadastrar-rosto" className="btn-light">
                <ScanFace size={17} /> Cadastrar meu rosto
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
