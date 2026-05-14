"use client";
import { useEffect, useCallback, useState } from "react";
import { X, Download, Share2, Heart, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { compartilharFoto } from "@/lib/compartilhar";

interface Props {
  fotos: { id: string; name: string }[];
  index: number;
  favoritos: Set<string>;
  nomeEvento?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFav: (id: string) => void;
}

function fullUrl(id: string) {
  return `/api/thumb?id=${id}&sz=original`;
}
function downloadUrl(id: string) {
  return `/api/download?id=${id}`;
}

export default function Lightbox({ fotos, index, favoritos, nomeEvento, onClose, onPrev, onNext, onToggleFav }: Props) {
  const foto = fotos[index];
  const fav  = favoritos.has(foto.id);

  // Feedback temporário do compartilhamento
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Fechar com ESC, navegar com setas
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape")     onClose();
    if (e.key === "ArrowLeft")  onPrev();
    if (e.key === "ArrowRight") onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  async function compartilhar() {
    const r = await compartilharFoto({ fotoId: foto.id, nomeEvento });
    if (r.ok) {
      const msg = r.canal === "clipboard" ? "Link copiado!"
        : r.canal === "whatsapp" ? "Abrindo WhatsApp..."
        : "Compartilhado!";
      setShareToast(msg);
      setTimeout(() => setShareToast(null), 2200);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Fundo escuro */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Conteúdo */}
      <div
        className="relative z-10 flex flex-col items-center w-full h-full max-w-5xl mx-auto px-4 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topbar */}
        <div className="w-full flex items-center justify-between mb-4 shrink-0">
          <p className="text-white/60 text-sm font-medium truncate max-w-xs">{foto.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">{index + 1} / {fotos.length}</span>

            {/* Favoritar */}
            <button
              onClick={() => onToggleFav(foto.id)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition
                ${fav ? "bg-red-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}>
              <Heart size={17} fill={fav ? "white" : "none"} />
            </button>

            {/* Compartilhar */}
            <button
              onClick={compartilhar}
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition">
              <Share2 size={17} />
            </button>

            {/* Baixar */}
            <a
              href={downloadUrl(foto.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition">
              <Download size={17} />
            </a>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-red-500 hover:text-white flex items-center justify-center transition">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Imagem */}
        <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
          {/* Botão anterior */}
          {index > 0 && (
            <button
              onClick={onPrev}
              className="absolute left-0 z-10 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition shadow-lg">
              <ChevronLeft size={22} />
            </button>
          )}

          <div className="relative flex items-center justify-center">
            <img
              key={foto.id}
              src={fullUrl(foto.id)}
              alt={foto.name}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl select-none"
              style={{ maxHeight: "calc(100vh - 160px)" }}
            />
            {/* Marca d'água */}
            <img
              src="/logos/logo.png"
              alt=""
              aria-hidden
              style={{ filter: "invert(1)", mixBlendMode: "screen", opacity: 0.5 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 h-6 w-auto object-contain pointer-events-none select-none"
            />
          </div>

          {/* Botão próximo */}
          {index < fotos.length - 1 && (
            <button
              onClick={onNext}
              className="absolute right-0 z-10 w-11 h-11 rounded-xl bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition shadow-lg">
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* Toast de compartilhamento */}
        {shareToast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-fade-up">
            <Check size={16} /> {shareToast}
          </div>
        )}

        {/* Miniaturas de navegação */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 max-w-full shrink-0">
          {fotos.slice(Math.max(0, index - 4), index + 5).map((f, i) => {
            const realIndex = Math.max(0, index - 4) + i;
            return (
              <button
                key={f.id}
                onClick={() => realIndex !== index && (realIndex < index ? onPrev() : onNext())}
                className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition border-2
                  ${realIndex === index ? "border-[#2E7DD1] scale-110" : "border-transparent opacity-50 hover:opacity-80"}`}
              >
                <img
                  src={`/api/thumb?id=${f.id}&sz=80`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
