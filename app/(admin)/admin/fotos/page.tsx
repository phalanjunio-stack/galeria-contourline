"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Camera, Download, Search, Loader2, Images,
  ChevronDown, X, ZoomIn, FolderOpen,
} from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

interface Foto { id: string; name: string; }

/* ── Lightbox ─────────────────────────────────────────── */
function Lightbox({ foto, onClose }: { foto: Foto; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
      >
        <X size={20} />
      </button>

      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
        <img
          src={`/api/thumb?id=${foto.id}&sz=1200`}
          alt={foto.name}
          className="w-full h-full object-contain rounded-2xl shadow-2xl max-h-[80vh]"
        />
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-white/60 text-sm truncate max-w-[70%]">{foto.name}</p>
          <a
            href={`/api/download?id=${foto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition"
          >
            <Download size={14} /> Baixar
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Card de foto ─────────────────────────────────────── */
function FotoCard({ foto, onClick }: { foto: Foto; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow hover:shadow-lg transition bg-gray-100"
    >
      {/* Blur placeholder */}
      <img
        src={`/api/thumb?id=${foto.id}&sz=40`}
        alt=""
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover scale-110 blur-lg transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
      />
      {/* Foto real */}
      <img
        src={`/api/thumb?id=${foto.id}&sz=300`}
        alt={foto.name}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {/* Overlay hover */}
      <div className="absolute inset-0 bg-[#0D2B4E]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ZoomIn size={24} className="text-white" />
      </div>
    </div>
  );
}

/* ── Página principal ─────────────────────────────────── */
export default function AdminFotosPage() {
  const [eventos,    setEventos]    = useState<EventoItem[]>([]);
  const [eventoId,   setEventoId]   = useState("");
  const [fotos,      setFotos]      = useState<Foto[]>([]);
  const [busca,      setBusca]      = useState("");
  const [carregando, setCarregando] = useState(false);
  const [lightbox,   setLightbox]   = useState<Foto | null>(null);
  const [pagina,     setPagina]     = useState(1);

  const POR_PAGINA = 60;

  useEffect(() => {
    fetch("/api/eventos").then(r => r.json()).then(data => {
      setEventos(Array.isArray(data) ? data.filter((e: EventoItem) => e.folder_id) : []);
    });
  }, []);

  const carregarFotos = useCallback(async (folderId: string) => {
    setCarregando(true);
    setFotos([]);
    setPagina(1);
    try {
      const res  = await fetch(`/api/fotos?folderId=${folderId}`);
      const data = await res.json();
      setFotos(data.fotos ?? []);
    } catch { /**/ }
    setCarregando(false);
  }, []);

  function handleEvento(id: string) {
    setEventoId(id);
    setBusca("");
    const ev = eventos.find(e => e.id === id);
    if (ev?.folder_id) carregarFotos(ev.folder_id);
    else setFotos([]);
  }

  const evento    = eventos.find(e => e.id === eventoId);
  const filtradas = busca
    ? fotos.filter(f => f.name.toLowerCase().includes(busca.toLowerCase()))
    : fotos;
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA);
  const visiveis     = filtradas.slice(0, pagina * POR_PAGINA);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
            <Images className="text-[#2E7DD1]" size={24} /> Fotos
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {eventoId && !carregando
              ? `${filtradas.length} foto${filtradas.length !== 1 ? "s" : ""} encontrada${filtradas.length !== 1 ? "s" : ""}`
              : "Selecione um evento para ver as fotos"}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Seletor de evento */}
        <div className="relative">
          <FolderOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={eventoId}
            onChange={e => handleEvento(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0D2B4E] bg-white focus:outline-none focus:border-[#2E7DD1] transition appearance-none min-w-[220px]"
          >
            <option value="">— Selecionar evento —</option>
            {eventos.map(e => (
              <option key={e.id} value={e.id}>{e.nome} ({e.total_fotos})</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Busca por nome */}
        {fotos.length > 0 && (
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome do arquivo..."
              value={busca}
              onChange={e => { setBusca(e.target.value); setPagina(1); }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0D2B4E] bg-white focus:outline-none focus:border-[#2E7DD1] transition"
            />
          </div>
        )}
      </div>

      {/* Estado vazio / loading */}
      {!eventoId && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow">
            <Camera size={28} className="text-white" />
          </div>
          <p className="font-semibold text-[#0D2B4E]">Nenhum evento selecionado</p>
          <p className="text-gray-400 text-sm">Escolha um evento acima para visualizar as fotos</p>
        </div>
      )}

      {carregando && (
        <div className="flex items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 size={22} className="animate-spin text-[#2E7DD1]" />
          <span className="text-sm text-gray-500 font-medium">Carregando fotos do Drive...</span>
        </div>
      )}

      {!carregando && eventoId && filtradas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Camera size={36} className="text-gray-200" />
          <p className="font-semibold text-[#0D2B4E]">Nenhuma foto encontrada</p>
          <p className="text-gray-400 text-sm">
            {busca ? "Tente outro termo de busca" : "Este evento não possui fotos na pasta do Drive"}
          </p>
        </div>
      )}

      {/* Grade de fotos */}
      {!carregando && visiveis.length > 0 && (
        <>
          {/* Info evento */}
          {evento && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Camera size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0D2B4E] text-sm truncate">{evento.nome}</p>
                <p className="text-gray-400 text-xs">
                  {new Date(evento.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  {" · "}{fotos.length} fotos no total
                </p>
              </div>
              <a
                href={`https://drive.google.com/drive/folders/${evento.folder_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2E7DD1] text-xs font-semibold hover:underline shrink-0"
              >
                Ver no Drive ↗
              </a>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {visiveis.map(foto => (
              <FotoCard key={foto.id} foto={foto} onClick={() => setLightbox(foto)} />
            ))}
          </div>

          {/* Carregar mais */}
          {pagina < totalPaginas && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setPagina(p => p + 1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-[#1A4A80] font-semibold text-sm hover:bg-[#EFF5FF] transition"
              >
                Carregar mais ({filtradas.length - visiveis.length} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox foto={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
