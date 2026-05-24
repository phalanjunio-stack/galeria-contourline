"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Filter, Calendar, Search, ScanFace, ChevronRight, X, Scan, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { EventoItem } from "@/app/api/eventos/route";
import {
  fetchMinhasFotos, lerCacheMinhasFotos, salvarCacheMinhasFotos,
  ouvirAtualizacoes, lerDescriptors, menorDistancia,
} from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";
import { lerRecognitionThresholdLocal } from "@/lib/recognition-thresholds";
import { SkeletonEventos } from "@/app/components/Skeleton";
import MultiDayEventCard from "@/app/components/MultiDayEventCard";
import SingleEventCard from "@/app/components/SingleEventCard";

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

  const eventosComDias = filtrados.filter((e) => (e.dias?.length ?? 0) > 1);
  const eventosSimples = filtrados.filter((e) => (e.dias?.length ?? 0) <= 1);
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

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-[#0D2B4E] mb-1">Eventos</h1>
        <p className="text-gray-500 text-sm">Encontre o evento e suas fotos</p>
      </div>

      {/* ── Banner "Acho que é você" ─────────────────────────────── */}
      {!bannerFechado && matches.length > 0 && (
        <div className="mb-8 bg-[#EFF5FF] border border-[#2E7DD1]/25 rounded-2xl p-5 relative animate-fade-up">
          <button
            onClick={() => setBannerFechado(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <X size={14} />
          </button>

          {/* Cabeçalho */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow">
              <ScanFace size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-[#0D2B4E]">
                Acho que é você{nomeUsuario ? `, ${nomeUsuario}` : ""}! 🤔
              </p>
              <p className="text-xs text-gray-500">
                {totalFotos} possível{totalFotos !== 1 ? "is" : ""} foto{totalFotos !== 1 ? "s" : ""} sua{totalFotos !== 1 ? "s" : ""} em {matches.length} evento{matches.length !== 1 ? "s" : ""} · <em>confira pra ter certeza</em>
              </p>
            </div>
            <Link href="/resultado"
              className="ml-auto flex items-center gap-1 text-[#2E7DD1] text-sm font-bold hover:underline shrink-0 pr-8">
              Conferir <ChevronRight size={14} />
            </Link>
          </div>
          <p className="text-[10px] text-amber-700/70 bg-amber-50/60 border border-amber-200/60 rounded-lg px-2 py-1 mb-3 inline-flex items-center gap-1">
            💡 A IA pode errar. Confira e marque as suas em <strong className="ml-0.5">São minhas</strong>.
          </p>

          {/* Um bloco por evento */}
          <div className="space-y-4">
            {matches.map(({ evento: ev, fotos }) => (
              <div key={ev.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#1A4A80] uppercase tracking-wide">{ev.nome}</p>
                  <Link href={`/eventos/${ev.id}`}
                    className="text-[10px] text-[#2E7DD1] font-semibold hover:underline flex items-center gap-0.5">
                    {fotos.length} foto{fotos.length !== 1 ? "s" : ""} <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {fotos.map(id => (
                    <Link key={id} href={`/eventos/${ev.id}`}
                      className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-md hover:scale-105 transition-transform duration-200">
                      <img src={`/api/thumb?id=${id}&sz=300`} alt=""
                        className="w-full h-full object-cover" />
                    </Link>
                  ))}
                  <Link href={`/eventos/${ev.id}`}
                    className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-[#2E7DD1]/40 flex flex-col items-center justify-center gap-1 text-[#2E7DD1] hover:bg-white transition">
                    <ChevronRight size={18} />
                    <span className="text-[10px] font-semibold">Ver tudo</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA para quem não tem rosto cadastrado */}
      {!bannerFechado && !temRosto && !loading && (
        <div className="mb-8 flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow">
            <ScanFace size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#0D2B4E] text-sm">Quer encontrar suas fotos automaticamente?</p>
            <p className="text-xs text-gray-400">Nossa IA te localiza em todos os eventos em segundos.</p>
          </div>
          <Link href="/cadastrar-rosto"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-90 transition shrink-0">
            <Scan size={13} /> Cadastrar rosto
          </Link>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, tag ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm focus:outline-none focus:border-[#2E7DD1] transition"
            />
          </div>
          <label className="relative">
            <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm font-semibold text-[#1A4A80] outline-none focus:border-[#2E7DD1]"
            >
              {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <label className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemEventos)}
              className="w-full appearance-none pl-9 pr-8 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm font-semibold text-[#1A4A80] outline-none focus:border-[#2E7DD1]"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigos</option>
              <option value="maisFotos">Mais fotos</option>
              <option value="az">A-Z</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setBusca(""); setCategoria("Todos"); setOrdem("recentes"); }}
            disabled={!filtrosAtivos}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-[#1A4A80] transition hover:border-[#2E7DD1] hover:bg-[#EFF5FF] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SlidersHorizontal size={15} /> Limpar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categorias.map((cat) => {
            const total = totalCategoria(cat);
            return (
              <button key={cat}
                onClick={() => setCategoria(cat)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition
                  ${categoria === cat ? "gradient-primary text-white shadow" : "bg-[#EFF5FF] border border-gray-200 text-[#1A4A80] hover:border-[#2E7DD1]"}`}>
                {cat} <span className={categoria === cat ? "text-white/75" : "text-gray-400"}>{total}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading com skeleton */}
      {loading && <SkeletonEventos count={8} />}

      {/* Sem eventos */}
      {!loading && filtrados.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">Nenhum evento encontrado.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtrados.length > 0 && (
        <>
          <div className="mb-5 flex items-end justify-between gap-3">
            <p className="text-gray-500 text-sm">{filtrados.length} eventos encontrados</p>
            {eventosComDias.length > 0 && (
              <p className="text-xs font-semibold text-[#2E7DD1]">{eventosComDias.length} com programacao por dias</p>
            )}
          </div>

          {eventosComDias.length > 0 && (
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[#0D2B4E]">Eventos com varios dias</h2>
                <p className="text-xs text-gray-500">Congressos, treinamentos e encontros com programacao separada por dia.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {eventosComDias.map((e) => (
                  <MultiDayEventCard key={e.id} evento={e} slug={e.id} />
                ))}
              </div>
            </section>
          )}

          {eventosSimples.length > 0 && (
            <section>
              {eventosComDias.length > 0 && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-[#0D2B4E]">Outros eventos</h2>
                  <p className="text-xs text-gray-500">Eventos com pasta unica ou um dia principal.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {eventosSimples.map((e) => {
                  const encontrado = matches.some(m => m.evento.id === e.id);
                  return <SingleEventCard key={e.id} evento={e} slug={e.id} encontrado={encontrado} />;
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
