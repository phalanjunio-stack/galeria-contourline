"use client";
import { useState } from "react";
import { Check } from "lucide-react";

// 9 posições disponíveis (grade 3×3) → valores CSS object-position
const POSICOES: { label: string; value: string; row: number; col: number }[] = [
  { label: "Topo esquerda",   value: "top left",      row: 0, col: 0 },
  { label: "Topo centro",     value: "top",           row: 0, col: 1 },
  { label: "Topo direita",    value: "top right",     row: 0, col: 2 },
  { label: "Meio esquerda",   value: "center left",   row: 1, col: 0 },
  { label: "Centro",          value: "center",        row: 1, col: 1 },
  { label: "Meio direita",    value: "center right",  row: 1, col: 2 },
  { label: "Base esquerda",   value: "bottom left",   row: 2, col: 0 },
  { label: "Base centro",     value: "bottom",        row: 2, col: 1 },
  { label: "Base direita",    value: "bottom right",  row: 2, col: 2 },
];

interface Props {
  /** ID da foto a usar como preview (thumb do Drive) */
  fotoId?: string;
  /** Posição atual (default "center") */
  value: string;
  onChange: (value: string) => void;
  /** Aspecto do preview — deve casar com onde a foto será exibida */
  aspect?: string; // ex: "16/10"
}

export default function FocalPointPicker({ fotoId, value, onChange, aspect = "16/10" }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const ativa = hover ?? value;

  if (!fotoId) {
    return (
      <div className="text-xs text-gray-400 italic">
        Defina uma foto como capa para escolher o ponto de foco.
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-2">
        Ponto de foco no card
      </div>

      {/* Preview da foto com grade 3×3 sobreposta */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-200 bg-[#07182f] shadow-inner"
        style={{ aspectRatio: aspect }}
      >
        <img
          src={`/api/thumb?id=${fotoId}&sz=600`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-[object-position] duration-300"
          style={{ objectPosition: ativa }}
        />
        {/* Grade 3×3 com botões clicáveis */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {POSICOES.map(p => {
            const selecionada = p.value === value;
            return (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={`Foco: ${p.label}`}
                onClick={() => onChange(p.value)}
                onMouseEnter={() => setHover(p.value)}
                onMouseLeave={() => setHover(null)}
                className={`relative border border-white/15 hover:bg-white/10 transition flex items-center justify-center
                  ${selecionada ? "bg-[#2E7DD1]/30" : ""}`}
              >
                <span
                  className={`w-6 h-6 rounded-full transition-all flex items-center justify-center
                    ${selecionada
                      ? "bg-gradient-to-br from-[#2E7DD1] to-[#7a3cff] shadow-lg scale-110"
                      : "bg-white/30 hover:bg-white/60 hover:scale-110"}`}
                >
                  {selecionada && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Clique numa das 9 regiões para escolher qual parte da foto fica visível no card.
        <span className="block text-emerald-600 font-semibold mt-0.5">
          ✓ {POSICOES.find(p => p.value === ativa)?.label}
        </span>
      </p>
    </div>
  );
}
