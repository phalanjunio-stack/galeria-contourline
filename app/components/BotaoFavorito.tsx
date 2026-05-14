"use client";
import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { toggleFavorito, isFavorito } from "@/app/(public)/favoritos/page";

export default function BotaoFavorito({
  fotoId,
  className = "",
  size = 15,
}: {
  fotoId: string;
  className?: string;
  size?: number;
}) {
  const [ativo, setAtivo] = useState(false);
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    setAtivo(isFavorito(fotoId));
  }, [fotoId]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const novoEstado = toggleFavorito(fotoId);
    setAtivo(novoEstado);
    setAnimar(true);
    setTimeout(() => setAnimar(false), 400);
  }

  return (
    <button
      onClick={handleClick}
      title={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={`flex items-center justify-center transition-all ${animar ? "scale-125" : "scale-100"} ${className}`}
    >
      <Heart
        size={size}
        className={`transition-colors ${ativo ? "fill-red-500 text-red-500" : "text-white"}`}
      />
    </button>
  );
}
