"use client";
import { LayoutGrid, Grid3x3, Smartphone, List, Zap, Square, CircleDot, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";
import { playSound } from "@/lib/sounds";

export type ViewMode = "grid" | "compact" | "mobile" | "list";
export type Quality = "rapido" | "normal" | "hd";

export interface ToolbarState {
  view: ViewMode;
  quality: Quality;
  size: number;
}

export const QUALITY_PX: Record<Quality, number> = {
  rapido: 300,
  normal: 600,
  hd:     1200,
};

interface Props {
  state: ToolbarState;
  onChange: (next: ToolbarState) => void;
  onFullscreen?: () => void;
}

export default function GaleriaToolbar({ state, onChange, onFullscreen }: Props) {
  const set = (patch: Partial<ToolbarState>) => {
    playSound("tap");
    onChange({ ...state, ...patch });
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 px-1.5 py-1.5 rounded-2xl
      border border-[#2E7DD1]/20 bg-white shadow-sm select-none">

      {/* ── View modes ── */}
      <div className="flex items-center gap-0.5 pr-2 border-r border-[#2E7DD1]/15">
        {(
          [
            { mode: "grid",    Icon: LayoutGrid, label: "Grade normal"   },
            { mode: "compact", Icon: Grid3x3,    label: "Grade compacta" },
            { mode: "mobile",  Icon: Smartphone, label: "Coluna única"   },
            { mode: "list",    Icon: List,       label: "Lista"          },
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
                color: active ? "#fff" : "#1A4A80",
                background: active
                  ? "linear-gradient(135deg, #2E7DD1 0%, #7a3cff 100%)"
                  : "transparent",
                boxShadow: active ? "0 2px 8px rgba(46,125,209,0.35)" : "none",
              }}
            >
              <Icon size={15} />
            </motion.button>
          );
        })}
      </div>

      {/* ── Quality ── */}
      <div className="flex items-center gap-0.5 px-2 border-r border-[#2E7DD1]/15">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap"
              style={{
                color: active ? "#fff" : "#1A4A80",
                background: active
                  ? "linear-gradient(135deg, #2E7DD1 0%, #7a3cff 100%)"
                  : "transparent",
                boxShadow: active ? "0 2px 8px rgba(46,125,209,0.35)" : "none",
              }}
            >
              <Icon size={12} />
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* ── Slider ── */}
      <div className="flex items-center gap-2 px-3 min-w-[130px]">
        <span className="w-2 h-2 rounded-sm shrink-0 bg-[#2E7DD1]/30" />
        <input
          type="range"
          min={1} max={10} step={1}
          value={state.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="flex-1 cursor-pointer"
          style={{ accentColor: "#7a3cff" }}
          aria-label="Tamanho dos thumbnails"
        />
        <span className="w-3 h-3 rounded-sm shrink-0 bg-[#7a3cff]/60" />
      </div>

      {/* ── Fullscreen (opcional) ── */}
      {onFullscreen && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => { playSound("open"); onFullscreen(); }}
          className="p-2 rounded-xl transition-all duration-150 ml-0.5"
          title="Expandir"
          style={{ color: "#1A4A80" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#7a3cff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#1A4A80")}
        >
          <Maximize2 size={14} />
        </motion.button>
      )}
    </div>
  );
}
