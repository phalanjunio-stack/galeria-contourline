"use client";
import { useEffect, useCallback, useState } from "react";
import { X, Download, Share2, Heart, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { compartilharFoto } from "@/lib/compartilhar";
import { playSound } from "@/lib/sounds";

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

  const [shareToast, setShareToast] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1); // direção da animação da foto
  const [zoom, setZoom] = useState<number>(1); // 1 = normal, 2 = 2x zoom

  // Reset zoom ao trocar foto
  useEffect(() => { setZoom(1); }, [foto.id]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape")     { playSound("close"); onClose(); }
    if (e.key === "ArrowLeft")  { setDir(-1); playSound("whoosh"); onPrev(); }
    if (e.key === "ArrowRight") { setDir(1);  playSound("whoosh"); onNext(); }
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    playSound("open");
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  function handleClose() {
    playSound("close");
    onClose();
  }

  function handlePrev() {
    setDir(-1);
    playSound("whoosh");
    onPrev();
  }

  function handleNext() {
    setDir(1);
    playSound("whoosh");
    onNext();
  }

  function handleFav() {
    playSound("snap");
    onToggleFav(foto.id);
  }

  async function compartilhar() {
    const r = await compartilharFoto({ fotoId: foto.id, nomeEvento });
    if (r.ok) {
      playSound("ding");
      const msg = r.canal === "clipboard" ? "Link copiado!"
        : r.canal === "whatsapp" ? "Abrindo WhatsApp..."
        : "Compartilhado!";
      setShareToast(msg);
      setTimeout(() => setShareToast(null), 2200);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleClose}
    >
      {/* Fundo escuro com blur */}
      <motion.div
        className="absolute inset-0 bg-black/92 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Conteúdo */}
      <motion.div
        className="relative z-10 flex flex-col items-center w-full h-full max-w-5xl mx-auto px-4 py-6"
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{ scale: 0.94, opacity: 0, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topbar */}
        <div className="w-full flex items-center justify-between mb-4 shrink-0">
          <p className="text-white/60 text-sm font-medium truncate max-w-xs">{foto.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">{index + 1} / {fotos.length}</span>

            {/* Favoritar */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleFav}
              aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150
                ${fav
                  ? "bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.5)]"
                  : "bg-white/10 text-white/70 hover:bg-red-500/80 hover:text-white hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]"}`}>
              <Heart size={17} fill={fav ? "white" : "none"} />
            </motion.button>

            {/* Compartilhar */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={compartilhar}
              aria-label="Compartilhar foto"
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition">
              <Share2 size={17} />
            </motion.button>

            {/* Baixar */}
            <motion.a
              whileTap={{ scale: 0.9 }}
              href={downloadUrl(foto.id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Baixar foto"
              onClick={() => playSound("tap")}
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-[#2E7DD1]/60 hover:text-white flex items-center justify-center transition">
              <Download size={17} />
            </motion.a>

            {/* Fechar */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              aria-label="Fechar"
              className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-red-500 hover:text-white flex items-center justify-center transition">
              <X size={17} />
            </motion.button>
          </div>
        </div>

        {/* Imagem com animação de slide */}
        <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
          {/* Botão anterior */}
          {index > 0 && (
            <motion.button
              whileHover={{ scale: 1.08, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrev}
              aria-label="Foto anterior"
              className="absolute left-0 z-10 w-11 h-11 rounded-xl bg-white/10 hover:bg-[#2E7DD1]/60
                hover:shadow-[0_0_16px_rgba(46,125,209,0.4)] text-white flex items-center justify-center transition-all duration-150 shadow-lg">
              <ChevronLeft size={22} />
            </motion.button>
          )}

          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={foto.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60, scale: 0.96 }}
              animate={{ opacity: 1, x: 0,        scale: 1    }}
              exit={{    opacity: 0, x: dir * -60, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              drag={zoom === 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                if (zoom !== 1) return;
                if (info.offset.x < -80 && index < fotos.length - 1) handleNext();
                else if (info.offset.x > 80 && index > 0) handlePrev();
              }}
              className="glow-active relative flex items-center justify-center rounded-2xl touch-pan-y"
            >
              <motion.img
                src={fullUrl(foto.id)}
                alt={foto.name}
                onDoubleClick={() => { playSound("tap"); setZoom(z => z === 1 ? 2 : 1); }}
                animate={{ scale: zoom }}
                transition={{ duration: 0.25 }}
                className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl select-none ${zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                style={{ maxHeight: "calc(100vh - 160px)" }}
                drag={zoom > 1}
                dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
              />
              {/* Marca d'água */}
              <img
                src="/logos/logo.png"
                alt=""
                aria-hidden
                style={{ filter: "invert(1)", mixBlendMode: "screen", opacity: 0.45 }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 h-6 w-auto object-contain pointer-events-none select-none"
              />
            </motion.div>
          </AnimatePresence>

          {/* Botão próximo */}
          {index < fotos.length - 1 && (
            <motion.button
              whileHover={{ scale: 1.08, x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              aria-label="Próxima foto"
              className="absolute right-0 z-10 w-11 h-11 rounded-xl bg-white/10 hover:bg-[#2E7DD1]/60
                hover:shadow-[0_0_16px_rgba(46,125,209,0.4)] text-white flex items-center justify-center transition-all duration-150 shadow-lg">
              <ChevronRight size={22} />
            </motion.button>
          )}
        </div>

        {/* Toast de compartilhamento */}
        <AnimatePresence>
          {shareToast && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{    opacity: 0, y: -10,  scale: 0.95 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-emerald-500 text-white
                px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold">
              <Check size={16} /> {shareToast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Miniaturas de navegação */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 max-w-full shrink-0">
          {fotos.slice(Math.max(0, index - 4), index + 5).map((f, i) => {
            const realIndex = Math.max(0, index - 4) + i;
            const isActive  = realIndex === index;
            return (
              <motion.button
                key={f.id}
                whileHover={{ scale: isActive ? 1.1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (realIndex !== index) {
                    if (realIndex < index) handlePrev();
                    else handleNext();
                  }
                }}
                className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all duration-200 border-2
                  ${isActive
                    ? "border-[#2E7DD1] scale-110 shadow-[0_0_10px_rgba(46,125,209,0.4)]"
                    : "border-transparent opacity-50 hover:opacity-80"}`}
              >
                <img
                  src={`/api/thumb?id=${f.id}&sz=80`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
