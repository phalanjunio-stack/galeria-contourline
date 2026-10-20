"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, ScanFace, ChevronRight, X, Scan, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { EventoItem } from "@/app/api/eventos/route";
import {
  fetchMinhasFotos, lerCacheMinhasFotos, salvarCacheMinhasFotos,
  ouvirAtualizacoes, lerDescriptors, menorDistancia,
} from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";
import { lerRecognitionThresholdLocal } from "@/lib/recognition-thresholds";
import { SkeletonEventos } from "@/app/components/Skeleton";
import EventTile from "@/app/components/EventTile";
import EventoEmAndamentoHero from "@/app/components/EventoEmAndamentoHero";

const categorias = [
  "Todos",
  "Evento",
  "Congresso",
  "Treinamento",
  "Corporativo",
  "Workshop",
  "Palestra",
  "Confraternizacao",
  "Outros",
];

type OrdemEventos = "recentes" | "antigas" | "maisFotos" | "az";

function normalizarFiltro(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

interface FotoDesc { fotoId: string; rostos: { descriptor: number[] }[] }

interface MatchEvento {
  evento: EventoItem;
  fotos: string[];   // ids
}

export default function EventosPage() {
  const [eventos,  setEventos]  = useState<EventoItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busca,    setBusca]    = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [ordem, setOrdem] = useState<OrdemEventos>("recentes");

  // Banner "Encontramos você"
  const [matches,       setMatches]       = useState<MatchEvento[]>([]);
  const [nomeUsuario,   setNomeUsuario]   = useState("");
  const [bannerFechado, setBannerFechado] = useState(false);
  const [temRosto,      setTemRosto]      = useState(false);

  // Busca fotos do usuário (Drive primeiro, descriptor como fallback)
  const buscarMinhasFotos = useCallback(async (lista: EventoItem[]) => {
    try {
      let nome = ""; let email = "";
      try {
        const u = JSON.parse(localStorage.getItem("usuario_simples") ?? "null");
        if (u) { nome = u.nome; email = u.email; }
      } catch { /**/ }
      const sessao = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
      if (sessao?.user) { nome = sessao.user.name ?? nome; email = sessao.user.email ?? email; }
      if (nome) setNomeUsuario(nome.split(" ")[0]);

      let descriptors = lerDescriptors();
      setTemRosto(descriptors.length > 0 || !!email);

      // 1. Fonte de verdade: Drive
      if (email) {
        const fresh = await fetchMinhasFotos(email);
        if (fresh?.porEvento?.length) {
          const r = fresh.porEvento
            .map(pe => {
              const ev = lista.find(e => e.id === pe.eventoId);
              return ev ? { evento: ev, fotos: pe.fotos.slice(0, 5) } : null;
            })
            .filter(Boolean) as MatchEvento[];
          if (r.length) { setMatches(r); return; }
        }
      }

      // 2. Fallback: descriptor vs índice de cada evento
      if (descriptors.length === 0 && email) {
        const perfilRes = await fetch(`/api/perfil?email=${encodeURIComponent(email)}`).catch(() => null);
        const perfil = perfilRes?.ok ? await perfilRes.json() : null;
        const doPerfil: number[][] = Array.isArray(perfil?.descriptors) && perfil.descriptors.length > 0
          ? perfil.descriptors
          : Array.isArray(perfil?.descriptor) && perfil.descriptor.length === 128
          ? [perfil.descriptor]
          : [];
        descriptors = doPerfil.map((descriptor) => new Float32Array(descriptor));
      }
      if (descriptors.length === 0) {
        setMatches([]);
        return;
      }
      const resultados: MatchEvento[] = [];
      const porEvento: { eventoId: string; eventoNome: string; fotos: string[] }[] = [];
      const limiar = lerRecognitionThresholdLocal("usuario");
      for (const ev of lista.filter(e => e.status === "aberto" && e.folder_id)) {
        const idxData = await fetchDescritores(ev.id);
        if (!idxData?.indexado || !idxData.dados?.length) continue;

        const encontradas: string[] = [];
        for (const foto of idxData.dados as FotoDesc[]) {
          let melhor = Infinity;
          for (const rosto of foto.rostos) {
            const distancia = menorDistancia(descriptors, rosto.descriptor);
            if (distancia < melhor) melhor = distancia;
          }
          if (melhor < limiar) encontradas.push(foto.fotoId);
        }
        if (encontradas.length) {
          resultados.push({ evento: ev, fotos: encontradas.slice(0, 5) });
          porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: encontradas });
        }
      }

      if (resultados.length > 0) {
        setMatches(resultados);
        if (email) {
          salvarCacheMinhasFotos(email, {
            matches: porEvento.flatMap(p => p.fotos.map(id => ({ id, distancia: 0.4 }))),
            porEvento,
          });
        }
      } else {
        setMatches([]);
      }
    } catch { /**/ }
  }, []);

  useEffect(() => {
    // Render imediato com cache local (se houver)
    try {
      const u = JSON.parse(localStorage.getItem("usuario_simples") ?? "null");
      if (u?.email) {
        const cached = lerCacheMinhasFotos(u.email);
        if (cached?.porEvento?.length) {
          window.setTimeout(() => {
            setMatches(cached.porEvento.map(pe => ({
              evento: { id: pe.eventoId, nome: pe.eventoNome } as EventoItem,
              fotos: pe.fotos.slice(0, 5),
            })));
          }, 0);
        }
      }
    } catch { /**/ }

    let listaCache: EventoItem[] = [];
    fetch("/api/eventos", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: EventoItem[]) => {
        const lista = Array.isArray(data) ? data : [];
        listaCache = lista;
        setEventos(lista);
        buscarMinhasFotos(lista);
      })
      .finally(() => setLoading(false));

    // Re-fetch quando outra página atualiza
    return ouvirAtualizacoes(() => {
      if (listaCache.length) buscarMinhasFotos(listaCache);
    });
  }, [buscarMinhasFotos]);

  const filtrados = useMemo(() => {
    const filtroBusca = normalizarFiltro(busca);
    const filtroCategoria = normalizarFiltro(categoria);
    const resultado = eventos.filter((e) => {
    const bateBusca = normalizarFiltro(e.nome).includes(filtroBusca)
      || !!e.tags?.some((tag) => normalizarFiltro(tag).includes(filtroBusca));
    const bateCategoria = categoria === "Todos"
      || normalizarFiltro(e.categoria) === filtroCategoria
      || !!e.tags?.some((tag) => normalizarFiltro(tag) === filtroCategoria);
    return bateBusca && bateCategoria;
    });
    return [...resultado].sort((a, b) => {
      if (ordem === "az") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "maisFotos") return (b.total_fotos ?? 0) - (a.total_fotos ?? 0);
      const dataA = new Date(a.data || a.criado_em || 0).getTime();
      const dataB = new Date(b.data || b.criado_em || 0).getTime();
      return ordem === "antigas" ? dataA - dataB : dataB - dataA;
    });
  }, [eventos, busca, categoria, ordem]);

  const filtrosAtivos = busca.trim() !== "" || categoria !== "Todos" || ordem !== "recentes";

  function totalCategoria(cat: string) {
    if (cat === "Todos") return eventos.length;
    const filtro = normalizarFiltro(cat);
    return eventos.filter((e) =>
      normalizarFiltro(e.categoria) === filtro
      || !!e.tags?.some((tag) => normalizarFiltro(tag) === filtro)
    ).length;
  }

  const totalFotos = matches.reduce((s, m) => s + m.fotos.length, 0);
  // Só mostra categorias que têm evento (e a selecionada, pra não sumir)
  const categoriasVisiveis = categorias.filter((cat) => cat === "Todos" || cat === categoria || totalCategoria(cat) > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Galeria</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--ink)] lg:text-4xl">Eventos</h1>
          <p className="mt-1.5 text-[var(--ink-soft)]">Escolha o evento e encontre suas fotos.</p>
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              type="search"
              placeholder="Buscar evento ou tag…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar evento"
              className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--card-bg)] pl-11 pr-4 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
            />
          </div>
          <label className="relative">
            <span className="sr-only">Ordenar</span>
            <ArrowUpDown size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemEventos)}
              className="h-11 appearance-none rounded-full border border-[var(--line)] bg-[var(--card-bg)] pl-10 pr-5 text-sm font-medium text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigos</option>
              <option value="maisFotos">Mais fotos</option>
              <option value="az">A-Z</option>
            </select>
          </label>
        </div>
      </div>

      {/* ── Hero "Evento em andamento" (só aparece se tiver um rolando hoje) ── */}
      {!loading && eventos.length > 0 && <EventoEmAndamentoHero eventos={eventos} />}

      {/* ── Banner "Acho que é você" ─────────────────────────────── */}
      {!bannerFechado && matches.length > 0 && (
        <div className="relative mb-8 animate-fade-up rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-5">
          <button
            onClick={() => setBannerFechado(true)}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[var(--ink-soft)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
            <X size={15} />
          </button>

          <div className="mb-4 flex flex-wrap items-center gap-3 pr-10">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2E7DD1] text-white">
              <ScanFace size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold text-[var(--ink)]">
                Acho que é você{nomeUsuario ? `, ${nomeUsuario}` : ""}!
              </p>
              <p className="text-sm text-[var(--ink-soft)]">
                {totalFotos} possível{totalFotos !== 1 ? "is" : ""} foto{totalFotos !== 1 ? "s" : ""} sua{totalFotos !== 1 ? "s" : ""} em {matches.length} evento{matches.length !== 1 ? "s" : ""}. A IA pode errar: confira e marque as suas em <strong>São minhas</strong>.
              </p>
            </div>
            <Link href="/resultado" className="btn-primary btn-sm">
              Conferir <ChevronRight size={15} />
            </Link>
          </div>

          <div className="space-y-4">
            {matches.map(({ evento: ev, fotos }) => (
              <div key={ev.id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{ev.nome}</p>
                  <Link href={`/eventos/${ev.id}`}
                    className="flex items-center gap-0.5 text-xs font-semibold text-[var(--accent)] hover:underline">
                    {fotos.length} foto{fotos.length !== 1 ? "s" : ""} <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {fotos.map(id => (
                    <Link key={id} href={`/eventos/${ev.id}`}
                      className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                      <img src={`/api/thumb?id=${id}&sz=300`} alt="" loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                    </Link>
                  ))}
                  <Link href={`/eventos/${ev.id}`}
                    className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--line)] text-[var(--accent)] transition hover:border-[var(--accent)] sm:h-24 sm:w-24">
                    <ChevronRight size={18} />
                    <span className="text-[11px] font-semibold">Ver tudo</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA para quem não tem rosto cadastrado */}
      {!bannerFechado && !temRosto && !loading && (
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#0B1F3A] p-5 text-white sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
            <ScanFace size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">Quer encontrar suas fotos automaticamente?</p>
            <p className="text-sm text-white/65">Cadastre seu rosto e a IA te localiza em todos os eventos.</p>
          </div>
          <Link href="/cadastrar-rosto" className="btn-light btn-sm">
            <Scan size={15} /> Cadastrar rosto
          </Link>
        </div>
      )}

      <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {categoriasVisiveis.map((cat) => (
          <button key={cat}
            onClick={() => setCategoria(cat)}
            aria-pressed={categoria === cat}
            className={`chip ${categoria === cat ? "is-active" : ""}`}>
            {cat === "Confraternizacao" ? "Confraternização" : cat}
            <span className="chip-count">{totalCategoria(cat)}</span>
          </button>
        ))}
        {filtrosAtivos && (
          <button type="button"
            onClick={() => { setBusca(""); setCategoria("Todos"); setOrdem("recentes"); }}
            className="chip">
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Loading com skeleton */}
      {loading && <SkeletonEventos count={6} />}

      {/* Sem eventos */}
      {!loading && filtrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--line)] py-20 text-center">
          <p className="text-sm text-[var(--ink-soft)]">Nenhum evento encontrado.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtrados.length > 0 && (
        <>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            {filtrados.length} evento{filtrados.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((e) => (
              <EventTile key={e.id} evento={e} slug={e.id} encontrado={matches.some(m => m.evento.id === e.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
