"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Images, ChevronDown, X, ArrowRight, Heart, Download } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import Lightbox from "@/app/components/Lightbox";
import { AnimatePresence } from "framer-motion";
import GaleriaLoading from "@/app/components/GaleriaLoading";
import GaleriaToolbar, { type ToolbarState, type ViewMode, QUALITY_PX } from "@/app/components/GaleriaToolbar";
import { lerFavoritos, salvarFavoritos } from "@/app/(public)/favoritos/page";
import { playSwoosh } from "@/lib/sounds";

const TOOLBAR_STORAGE_KEY = "galeria-toolbar";
const DEFAULT_TOOLBAR: ToolbarState = { view: "grid", quality: "normal", size: 5 };

interface Foto { id: string; name: string; eventoId: string; eventoNome: string; eventoSlug: string; }

function slugify(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* Card individual da galeria — proporção natural da foto */
function GaleriaCard({
  foto, index, favoritada, eventoFiltro, thumbPx, view,
  onOpenLightbox, onToggleFav, onFiltrarEvento,
}: {
  foto: Foto; index: number; favoritada: boolean; eventoFiltro: string | null;
  thumbPx: number; view: ViewMode;
  onOpenLightbox: () => void; onToggleFav: () => void; onFiltrarEvento: () => void;
}) {
  const [loaded,  setLoaded]  = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const delay = `${(index % 6) * 50}ms`;
  const isList = view === "list";

  return (
    <div
      ref={ref}
      style={visible ? { animationDelay: delay } : { opacity: 0 }}
      className={`group relative ${isList ? "flex gap-3 items-center" : "break-inside-avoid mb-3"} rounded-xl overflow-hidden cursor-pointer shadow hover:shadow-xl transition-all duration-300
        ${visible ? "animate-fade-up" : ""} ${isList ? "bg-white border border-gray-100 p-2" : ""}`}
      onClick={onOpenLightbox}
    >
      {/* Skeleton */}
      {!loaded && (
        <div className={`${isList ? "w-24 h-24 shrink-0" : "w-full aspect-[4/3]"} bg-gradient-to-br from-[#1A4A80]/20 to-[#2E7DD1]/20 animate-pulse rounded-xl`} />
      )}

      {/* Imagem com proporção natural */}
      {visible && (
        <img
          src={`/api/thumb?id=${foto.id}&sz=${thumbPx}`}
          alt={foto.name}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`${isList ? "w-24 h-24 object-cover shrink-0 rounded-lg" : "w-full h-auto"} block transition-all duration-500 group-hover:scale-[1.02]
            ${loaded ? "opacity-100" : "opacity-0 absolute inset-0"}`}
        />
      )}

      {/* Info no modo lista */}
      {isList && loaded && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0D2B4E] truncate">{foto.eventoNome}</p>
          <p className="text-xs text-gray-400 truncate">{foto.name}</p>
        </div>
      )}

      {/* Overlay hover */}
      {loaded && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">

          {/* Ações */}
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition
                ${favoritada ? "bg-red-500" : "bg-white/20 hover:bg-white/40"}`}>
              <Heart size={14} className="text-white" fill={favoritada ? "white" : "none"} />
            </button>

            <a
              href={`/api/download?id=${foto.id}`}
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
              <Download size={14} className="text-white" />
            </a>
          </div>
        </div>
      )}

      {/* Marca d'água */}
      {loaded && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-4 pointer-events-none select-none z-10">
          <img src="/logos/logo.png" alt="" aria-hidden
            style={{ filter: "invert(1)", mixBlendMode: "screen", opacity: 0.45 }}
            className="h-4 w-auto object-contain" />
        </div>
      )}

      {/* Tag do evento (hover, só no feed geral) */}
      {loaded && !eventoFiltro && (
        <button
          onClick={(e) => { e.stopPropagation(); onFiltrarEvento(); }}
          className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm
            text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity
            hover:bg-[#2E7DD1] max-w-[130px] truncate">
          {foto.eventoNome}
        </button>
      )}
    </div>
  );
}

export default function GaleriaPage() {
  const [eventos,      setEventos]      = useState<EventoItem[]>([]);
  const [fotos,        setFotos]        = useState<Foto[]>([]);
  const [eventoFiltro, setEventoFiltro] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null);
  const [favoritos,    setFavoritos]    = useState<Set<string>>(new Set());
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [toolbar,      setToolbar]      = useState<ToolbarState>(DEFAULT_TOOLBAR);
  const fotoCache = useRef<Map<string, Foto[]>>(new Map());

  // Carrega favoritos do localStorage na inicialização
  useEffect(() => {
    setFavoritos(new Set(lerFavoritos()));
    try {
      const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      if (raw) setToolbar({ ...DEFAULT_TOOLBAR, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function updateToolbar(next: ToolbarState) {
    setToolbar(next);
    try { localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  useEffect(() => {
    fetch("/api/eventos")
      .then(r => r.json())
      .then(async (lista: EventoItem[]) => {
        const ativos = lista.filter(e => e.folder_id && e.status === "aberto");
        setEventos(ativos);

        const todas: Foto[] = [];
        await Promise.all(ativos.map(async (ev) => {
          try {
            const cacheKey = `fotos_${ev.folder_id}`;
            let raw: { id: string; name: string }[] = [];
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              raw = JSON.parse(cached).fotos ?? [];
            } else {
              const res  = await fetch(`/api/fotos?folderId=${ev.folder_id}`);
              const data = await res.json();
              raw = data.fotos ?? [];
              localStorage.setItem(cacheKey, JSON.stringify({ fotos: raw, ts: Date.now() }));
            }
            const slug = slugify(ev.nome);
            const mapped: Foto[] = raw.map(f => ({ ...f, eventoId: ev.id, eventoNome: ev.nome, eventoSlug: slug }));
            // Deduplicar por id dentro do evento antes de adicionar
            const unicas = Array.from(new Map(mapped.map(f => [f.id, f])).values());
            fotoCache.current.set(ev.id, unicas);
            todas.push(...unicas.slice(0, 120)); // até 120 por evento no feed geral
          } catch { /**/ }
        }));

        // Deduplicar cross-evento e embaralhar para misturar
        const semDup = Array.from(new Map(todas.map(f => [f.id, f])).values());
        semDup.sort(() => Math.random() - 0.5);
        setFotos(semDup);
        setLoading(false);
      });
  }, []);

  function toggleFav(id: string) {
    setFavoritos(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      // Persiste no localStorage compartilhado com a página /favoritos
      salvarFavoritos(Array.from(n));
      return n;
    });
  }

  const fotosFiltradas = eventoFiltro
    ? (fotoCache.current.get(eventoFiltro) ?? fotos.filter(f => f.eventoId === eventoFiltro))
    : fotos;

  const eventoSelecionado = eventos.find(e => e.id === eventoFiltro);

  if (loading) return <GaleriaLoading label="Carregando galeria..." />;

  // Layout dinâmico baseado em view + size
  const thumbPx = QUALITY_PX[toolbar.quality];
  // size 1..10 → mapeia para nº de colunas (size baixo = mais colunas/menores; size alto = menos colunas/maiores)
  function gridClasses(): string {
    if (toolbar.view === "mobile") return "columns-1";
    if (toolbar.view === "list")   return "flex flex-col gap-2";
    const s = toolbar.size;
    if (toolbar.view === "compact") {
      // mais densa
      if (s <= 2) return "columns-3 sm:columns-5 lg:columns-7";
      if (s <= 4) return "columns-3 sm:columns-4 lg:columns-6";
      if (s <= 6) return "columns-2 sm:columns-4 lg:columns-5";
      if (s <= 8) return "columns-2 sm:columns-3 lg:columns-4";
      return "columns-2 sm:columns-3 lg:columns-3";
    }
    // grid normal
    if (s <= 2) return "columns-2 sm:columns-4 lg:columns-6";
    if (s <= 4) return "columns-2 sm:columns-3 lg:columns-5";
    if (s <= 6) return "columns-2 sm:columns-3 lg:columns-4";
    if (s <= 8) return "columns-1 sm:columns-2 lg:columns-3";
    return "columns-1 sm:columns-2 lg:columns-2";
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Images size={20} className="text-[#2E7DD1]" />
            <h1 className="text-2xl font-bold text-[#0D2B4E]">Galeria</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {eventoFiltro
              ? `${fotosFiltradas.length} fotos · ${eventoSelecionado?.nome}`
              : `${fotosFiltradas.length} fotos de ${eventos.length} eventos`}
          </p>
        </div>

        {/* Filtro por evento */}
        <div className="relative z-30">
          <button
            onClick={() => { playSwoosh(filtroAberto ? "close" : "open"); setFiltroAberto(v => !v); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[#1A4A80] font-semibold text-sm hover:bg-[#EFF5FF] transition shadow-sm">
            {eventoFiltro ? eventoSelecionado?.nome : "Todos os eventos"}
            {eventoFiltro
              ? <X size={14} className="text-gray-400" onClick={(e) => { e.stopPropagation(); setEventoFiltro(null); setFiltroAberto(false); }} />
              : <ChevronDown size={14} />}
          </button>

          {filtroAberto && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-30 overflow-hidden animate-slide-up">
              <button
                onClick={() => { setEventoFiltro(null); setFiltroAberto(false); }}
                className={`w-full text-left px-4 py-3 text-sm font-semibold hover:bg-[#EFF5FF] transition
                  ${!eventoFiltro ? "text-[#2E7DD1] bg-[#EFF5FF]" : "text-[#0D2B4E]"}`}>
                Todos os eventos
              </button>
              {eventos.map(ev => (
                <button key={ev.id}
                  onClick={() => { setEventoFiltro(ev.id); setFiltroAberto(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF5FF] transition border-t border-gray-50
                    ${eventoFiltro === ev.id ? "text-[#2E7DD1] font-semibold bg-[#EFF5FF]" : "text-gray-700"}`}>
                  <div className="font-medium">{ev.nome}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(ev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar de visualização */}
      <div className="mb-4">
        <GaleriaToolbar state={toolbar} onChange={updateToolbar} />
      </div>

      {/* Banner "ver evento completo" */}
      {eventoFiltro && eventoSelecionado && (
        <div className="flex items-center justify-between bg-[#EFF5FF] border border-[#2E7DD1]/20 rounded-2xl px-5 py-3 mb-6">
          <div>
            <p className="font-semibold text-[#0D2B4E] text-sm">{eventoSelecionado.nome}</p>
            <p className="text-xs text-gray-400">
              {new Date(eventoSelecionado.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <Link
            href={`/eventos/${eventoSelecionado.id}-${slugify(eventoSelecionado.nome)}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold shadow hover:opacity-90 transition">
            Ver evento completo <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Grid masonry com proporção natural */}
      {fotosFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Images size={40} className="text-gray-300" />
          <p className="font-semibold text-[#0D2B4E]">Nenhuma foto encontrada</p>
        </div>
      ) : (
        <div className={`${gridClasses()} gap-3`}>
          {fotosFiltradas.map((foto, idx) => (
            <GaleriaCard
              key={foto.id}
              foto={foto}
              index={idx}
              favoritada={favoritos.has(foto.id)}
              eventoFiltro={eventoFiltro}
              thumbPx={thumbPx}
              view={toolbar.view}
              onOpenLightbox={() => setLightboxIdx(idx)}
              onToggleFav={() => toggleFav(foto.id)}
              onFiltrarEvento={() => setEventoFiltro(foto.eventoId)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox
            fotos={fotosFiltradas}
            index={lightboxIdx}
            favoritos={favoritos}
            onClose={() => setLightboxIdx(null)}
            onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
            onNext={() => setLightboxIdx(i => Math.min(fotosFiltradas.length - 1, (i ?? 0) + 1))}
            onToggleFav={toggleFav}
          />
        )}
      </AnimatePresence>

      {/* Fecha filtro clicando fora */}
      {filtroAberto && <div className="fixed inset-0 z-20" onClick={() => setFiltroAberto(false)} />}
    </div>
  );
}
