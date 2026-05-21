"use client";
import { LayoutGrid, Grid3x3, Smartphone, List, Zap, Square, CircleDot, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";
import { playSound } from "@/lib/sounds";

export type ViewMode = "grid" | "compact" | "mobile" | "list";
export type Quality = "rapido" | "normal" | "hd";

export interface ToolbarState {
  view: ViewMode;
  quality: Quality;
  size: number; // 1..10 — controla largura mínima da coluna
}

export const QUALITY_PX: Record<Quality, number> = {
  rapido: 300,
  normal: 600,
  hd:     1200,
};

interface Props {
  state: ToolbarState;
  onChange: (next: ToolbarState) => void;
  /** Callback opcional ao clicar em fullscreen/expand */
  onFullscreen?: () => void;
}

export default function GaleriaToolbar({ state, onChange, onFullscreen }: Props) {
  const set = (patch: Partial<ToolbarState>) => {
    playSound("tap");
    onChange({ ...state, ...patch });
  };

  return (
    <div
      className="inline-flex flex-wrap items-center gap-0.5 px-1.5 py-1.5 rounded-2xl
        border backdrop-blur-md select-none"
      style={{
        background: "rgba(13,43,78,0.88)",
        borderColor: "rgba(46,125,209,0.25)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Grupo: View modes ── */}
      <div className="flex items-center gap-0.5 pr-2 border-r"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(
          [
            { mode: "grid",    Icon: LayoutGrid, label: "Grade normal"    },
            { mode: "compact", Icon: Grid3x3,    label: "Grade compacta"  },
            { mode: "mobile",  Icon: Smartphone, label: "Coluna única"    },
            { mode: "list",    Icon: List,       label: "Lista"           },
          ] as const
        ).map(({ mode, Icon, label }) => {
          const active = state.view === mode;
          return (
            <motion.button
              key={mode}
              whileTap={{ scale: 0.88 }}
              onClick={() => set({ view: mode })}
              title={label}
              aria-label={label}
              className="relative p-2 rounded-xl transition-all duration-150 flex items-center justify-center"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.45)",
                background: active
                  ? "linear-gradient(135deg, #2E7DD1 0%, #5BA4E5 100%)"
                  : "transparent",
                boxShadow: active ? "0 2px 8px rgba(46,125,209,0.4)" : "none",
              }}
            >
              <Icon size={15} />
            </motion.button>
          );
        })}
      </div>

      {/* ── Grupo: Quality ── */}
      <div className="flex items-center gap-0.5 px-2 border-r"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(
          [
            { q: "rapido", Icon: Zap,       label: "Rápido" },
            { q: "normal", Icon: Square,    label: "Normal" },
            { q: "hd",     Icon: CircleDot, label: "HD"     },
          ] as const
        ).map(({ q, Icon, label }) => {
          const active = state.quality === q;
          return (
            <motion.button
              key={q}
              whileTap={{ scale: 0.9 }}
              onClick={() => set({ quality: q })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                transition-all duration-150 whitespace-nowrap"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                background: active
                  ? "linear-gradient(135deg, #2E7DD1 0%, #5BA4E5 100%)"
                  : "transparent",
                boxShadow: active ? "0 2px 8px rgba(46,125,209,0.4)" : "none",
              }}
            >
              <Icon size={12} />
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* ── Slider de tamanho ── */}
      <div className="flex items-center gap-2 px-3 min-w-[130px]">
        {/* Ícone menor */}
        <span className="w-2 h-2 rounded-sm shrink-0"
          style={{ background: "rgba(91,164,229,0.4)" }} />

        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={state.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="flex-1 cursor-pointer"
          style={{ accentColor: "#5BA4E5" }}
          aria-label="Tamanho dos thumbnails"
        />

        {/* Ícone maior */}
        <span className="w-3 h-3 rounded-sm shrink-0"
          style={{ background: "rgba(46,125,209,0.7)" }} />
      </div>

      {/* ── Botão fullscreen (opcional) ── */}
      {onFullscreen && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => { playSound("open"); onFullscreen(); }}
          className="p-2 rounded-xl transition-all duration-150 ml-0.5"
          title="Expandir"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <Maximize2 size={14} />
        </motion.button>
      )}
    </div>
  );
}
