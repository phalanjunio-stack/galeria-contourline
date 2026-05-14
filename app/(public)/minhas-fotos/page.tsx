"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ScanFace, X, ChevronDown, ChevronRight, Download, Heart, Scan,
} from "lucide-react";
import { fetchMinhasFotos, ouvirAtualizacoes } from "@/lib/minhasFotos";
import { lerFavoritos, salvarFavoritos } from "@/app/(public)/favoritos/page";
import Lightbox from "@/app/components/Lightbox";
import { SkeletonFotos } from "@/app/components/Skeleton";

interface FotoMin { id: string; eventoId: string; eventoNome: string; }

function getEmailLocal(): string {
  try { return JSON.parse(localStorage.getItem("usuario_simples") ?? "{}").email ?? ""; } catch { return ""; }
}

export default function MinhasFotosPage() {
  const { data: session, status } = useSession();
  const [email,        setEmail]        = useState("");
  const [fotos,        setFotos]        = useState<FotoMin[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [eventoFiltro, setEventoFiltro] = useState<string | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [favoritos,    setFavoritos]    = useState<Set<string>>(new Set());
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null);

  // Carrega email + favoritos
  useEffect(() => {
    if (status === "loading") return;
    setFavoritos(new Set(lerFavoritos()));
    setEmail(session?.user?.email ?? getEmailLocal());
  }, [session, status]);

  const carregar = useCallback(async () => {
    if (!email) { setLoading(false); return; }
    setLoading(true);
    const fresh = await fetchMinhasFotos(email);
    const lista: FotoMin[] = [];
    if (fresh?.porEvento) {
      for (const ev of fresh.porEvento) {
        for (const id of ev.fotos) {
          if (!lista.some(f => f.id === id)) {
            lista.push({ id, eventoId: ev.eventoId, eventoNome: ev.eventoNome });
          }
        }
      }
    }
    setFotos(lista);
    setLoading(false);
  }, [email]);

  useEffect(() => {
    carregar();
    return ouvirAtualizacoes(carregar);
  }, [carregar]);

  function toggleFav(id: string) {
    setFavoritos(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      salvarFavoritos(Array.from(n));
      return n;
    });
  }

  const eventos = Array.from(
    fotos.reduce((acc, f) => {
      const cur = acc.get(f.eventoId);
      acc.set(f.eventoId, { nome: f.eventoNome, count: (cur?.count ?? 0) + 1 });
      return acc;
    }, new Map<string, { nome: string; count: number }>())
  ).map(([id, v]) => ({ id, ...v }));

  const fotosFiltradas = eventoFiltro ? fotos.filter(f => f.eventoId === eventoFiltro) : fotos;
  const eventoSel      = eventos.find(e => e.id === eventoFiltro);

  /* ── Loading com skeleton ─────────────────────────────────── */
  if (loading || status === "loading") return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ScanFace size={20} className="text-[#2E7DD1]" />
          <h1 className="text-2xl font-bold text-[#0D2B4E]">Minhas fotos</h1>
        </div>
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
      <SkeletonFotos count={12} />
    </div>
  );

  /* ── Sem identificação ────────────────────────────────────── */
  if (!email) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-lg">
        <ScanFace size={28} className="text-white" />
      </div>
      <h1 className="text-2xl font-black text-[#0D2B4E] mb-2">Minhas fotos</h1>
      <p className="text-gray-400 text-sm mb-6">Cadastre seu rosto pra encontrarmos você automaticamente nos eventos.</p>
      <Link href="/cadastrar-rosto"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow hover:opacity-90 transition">
        <Scan size={15} /> Cadastrar rosto
      </Link>
    </div>
  );

  /* ── Vazio ────────────────────────────────────────────────── */
  if (fotos.length === 0) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#EFF5FF] flex items-center justify-center mx-auto mb-5 border border-[#2E7DD1]/20">
        <ScanFace size={28} className="text-[#2E7DD1]" />
      </div>
      <h1 className="text-2xl font-black text-[#0D2B4E] mb-2">Ainda não há fotos suas</h1>
      <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
        Quando o admin indexar um evento e a IA encontrar você, suas fotos aparecem aqui.
        Você também pode buscar manualmente.
      </p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Link href="/resultado"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold shadow hover:opacity-90 transition">
          <Scan size={14} /> Buscar nas fotos agora
        </Link>
        <Link href="/cadastrar-rosto"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#2E7DD1]/40 text-[#2E7DD1] text-sm font-semibold hover:bg-[#EFF5FF] transition">
          Atualizar rosto cadastrado
        </Link>
      </div>
    </div>
  );

  /* ── Grid ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScanFace size={20} className="text-[#2E7DD1]" />
            <h1 className="text-2xl font-bold text-[#0D2B4E]">Minhas fotos</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {eventoFiltro
              ? `${fotosFiltradas.length} foto${fotosFiltradas.length !== 1 ? "s" : ""} · ${eventoSel?.nome}`
              : `${fotos.length} foto${fotos.length !== 1 ? "s" : ""} em ${eventos.length} evento${eventos.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {eventos.length > 1 && (
          <div className="relative z-30">
            <button
              onClick={() => setFiltroAberto(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[#1A4A80] font-semibold text-sm hover:bg-[#EFF5FF] transition shadow-sm">
              {eventoFiltro ? eventoSel?.nome : "Todos os eventos"}
              {eventoFiltro
                ? <X size={14} className="text-gray-400"
                    onClick={(e) => { e.stopPropagation(); setEventoFiltro(null); setFiltroAberto(false); }} />
                : <ChevronDown size={14} />}
            </button>

            {filtroAberto && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-30 overflow-hidden animate-slide-up">
                <button
                  onClick={() => { setEventoFiltro(null); setFiltroAberto(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF5FF] transition flex items-center justify-between
                    ${!eventoFiltro ? "text-[#2E7DD1] font-semibold bg-[#EFF5FF]" : "text-[#0D2B4E]"}`}>
                  <span>Todos</span>
                  <span className="text-xs text-gray-400">{fotos.length}</span>
                </button>
                {eventos.map(ev => (
                  <button key={ev.id}
                    onClick={() => { setEventoFiltro(ev.id); setFiltroAberto(false); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF5FF] transition border-t border-gray-50 flex items-center justify-between gap-2
                      ${eventoFiltro === ev.id ? "text-[#2E7DD1] font-semibold bg-[#EFF5FF]" : "text-gray-700"}`}>
                    <span className="truncate">{ev.nome}</span>
                    <span className="text-xs text-gray-400 shrink-0">{ev.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid masonry */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {fotosFiltradas.map((foto, idx) => {
          const fav = favoritos.has(foto.id);
          return (
            <div
              key={foto.id}
              onClick={() => setLightboxIdx(idx)}
              className="group relative break-inside-avoid mb-3 rounded-xl overflow-hidden cursor-pointer shadow hover:shadow-xl transition-all duration-300">
              <img src={`/api/thumb?id=${foto.id}&sz=600`} alt=""
                loading="lazy" decoding="async"
                className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" />

              {/* Overlay ações */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent
                opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                <div className="flex items-center justify-between">
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(foto.id); }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition
                      ${fav ? "bg-red-500" : "bg-white/20 hover:bg-white/40"}`}>
                    <Heart size={14} className="text-white" fill={fav ? "white" : "none"} />
                  </button>
                  <a href={`/api/download?id=${foto.id}`} onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
                    <Download size={14} className="text-white" />
                  </a>
                </div>
              </div>

              {/* Tag evento (no feed agregado) */}
              {!eventoFiltro && (
                <Link href={`/eventos/${foto.eventoId}?filtro=minhas`}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm
                    text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity
                    hover:bg-[#2E7DD1] max-w-[130px] truncate">
                  {foto.eventoNome}
                </Link>
              )}

              {/* Favorito permanente */}
              {fav && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow z-10">
                  <Heart size={10} className="text-white fill-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Atalho pra evento */}
      {eventoFiltro && eventoSel && (
        <div className="mt-8 text-center">
          <Link href={`/eventos/${eventoFiltro}`}
            className="inline-flex items-center gap-2 text-[#2E7DD1] text-sm font-semibold hover:underline">
            Ver evento completo: {eventoSel.nome} <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          fotos={fotosFiltradas.map(f => ({ id: f.id, name: f.id }))}
          index={lightboxIdx}
          favoritos={favoritos}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx(i => Math.min(fotosFiltradas.length - 1, (i ?? 0) + 1))}
          onToggleFav={toggleFav}
        />
      )}

      {filtroAberto && <div className="fixed inset-0 z-20" onClick={() => setFiltroAberto(false)} />}
    </div>
  );
}
