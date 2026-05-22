"use client";
import { useState, useRef, useEffect } from "react";
import { Download, Heart, CheckSquare, Check, ImagePlus } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface Props {
  id: string;
  name: string;
  index?: number;
  selecionada: boolean;
  favoritada: boolean;
  modoSelecao: boolean;
  isCapa?: boolean;
  isAdmin?: boolean;
  masonry?: boolean;
  onToggleSel: () => void;
  onToggleFav: () => void;
  onIniciarSelecao: () => void;
  onOpenLightbox: () => void;
  onDefinirCapa?: () => void;
  downloadUrl: string;
}

function thumbUrl(id: string, size: number) {
  return `/api/thumb?id=${id}&sz=${size}`;
}

export default function FotoCard({
  id, name, index = 0, selecionada, favoritada, modoSelecao,
  isCapa, isAdmin, masonry = false,
  onToggleSel, onToggleFav, onIniciarSelecao, onOpenLightbox, onDefinirCapa, downloadUrl,
}: Props) {
  const [loaded,  setLoaded]  = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Delay escalonado por linha (máx 5 colunas → ciclo de 5)
  const delay = `${(index % 5) * 60}ms`;

  function handleClick() {
    if (modoSelecao) {
      playSound("snap");
      onToggleSel();
    } else {
      playSound("open");
      onOpenLightbox();
    }
  }

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    playSound("snap");
    onToggleFav();
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    playSound("tap");
  }

  function handleIniciarSelecao(e: React.MouseEvent) {
    e.stopPropagation();
    playSound("snap");
    onIniciarSelecao();
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={visible ? { animationDelay: delay } : { opacity: 0 }}
      className={`glow-card group relative rounded-xl overflow-hidden shadow transition-all duration-200 cursor-pointer
        ${masonry ? "break-inside-avoid mb-3" : "aspect-square"}
        ${visible ? "animate-fade-up" : ""}
        ${selecionada ? "ring-[3px] ring-[#2E7DD1] ring-offset-2 scale-[0.97]" : "hover:shadow-xl hover:-translate-y-0.5"}`}
    >
      {/* Inner — fica acima da borda glow */}
      <div className="relative w-full h-full rounded-xl overflow-hidden z-[2]
        bg-gradient-to-br from-[#1A4A80]/10 to-[#2E7DD1]/10">

        {/* Skeleton */}
        {!loaded && (
          <div className={`bg-gradient-to-br from-[#1A4A80]/30 to-[#2E7DD1]/30 animate-pulse
            ${masonry ? "w-full aspect-[4/3]" : "absolute inset-0"}`} />
        )}

        {/* Blur placeholder */}
        {visible && (
          <img
            src={thumbUrl(id, 40)}
            alt=""
            aria-hidden
            className={`absolute inset-0 w-full h-full object-cover scale-110 blur-lg transition-opacity duration-300
              ${loaded ? "opacity-0" : "opacity-100"}`}
          />
        )}

        {/* Thumbnail real */}
        {visible && (
          <img
            src={thumbUrl(id, 400)}
            alt={name}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`transition-all duration-500 group-hover:scale-[1.03]
              ${masonry
                ? `w-full h-auto block ${loaded ? "opacity-100" : "opacity-0"}`
                : `absolute inset-0 w-full h-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`
              }`}
          />
        )}

        {/* Badge de capa atual */}
        {isCapa && !modoSelecao && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2E7DD1] text-white text-[10px] font-bold shadow">
            <ImagePlus size={10} /> CAPA
          </div>
        )}

        {/* Checkbox */}
        {modoSelecao && (
          <div className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center shadow-md transition-all z-10
            ${selecionada ? "gradient-primary scale-110" : "bg-white/90 border border-gray-300"}`}>
            {selecionada && <Check size={13} className="text-white" strokeWidth={3} />}
          </div>
        )}

        {/* Overlay hover */}
        {!modoSelecao && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/70 via-[#0D2B4E]/10 to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-200
            flex items-end justify-between p-2 z-10">
            <button
              aria-label={favoritada ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              onClick={handleFav}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150
                ${favoritada
                  ? "bg-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : "bg-white/20 hover:bg-red-500/80 hover:scale-110"}`}>
              <Heart size={14} className="text-white" fill={favoritada ? "white" : "none"} />
            </button>
            <div className="flex gap-1">
              {isAdmin && onDefinirCapa && !isCapa && (
                <button
                  aria-label="Definir como capa do evento"
                  title="Definir como capa do evento"
                  onClick={(e) => { e.stopPropagation(); onDefinirCapa(); }}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-[#2E7DD1] hover:scale-110 flex items-center justify-center transition-all duration-150">
                  <ImagePlus size={14} className="text-white" />
                </button>
              )}
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Baixar foto"
                onClick={handleDownload}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 hover:scale-110 flex items-center justify-center transition-all duration-150">
                <Download size={14} className="text-white" />
              </a>
              <button
                aria-label="Selecionar foto"
                onClick={handleIniciarSelecao}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 hover:scale-110 flex items-center justify-center transition-all duration-150">
                <CheckSquare size={14} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Overlay selecionada */}
        {modoSelecao && selecionada && (
          <div className="absolute inset-0 bg-[#2E7DD1]/25 pointer-events-none z-10" />
        )}

        {/* Marca d'água permanente */}
        {loaded && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-4 z-20 pointer-events-none select-none">
            <img
              src="/logos/logo.png"
              alt=""
              aria-hidden
              style={{ filter: "invert(1)", mixBlendMode: "screen", opacity: 0.45 }}
              className="h-5 w-auto object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
