"use client";
import { LayoutGrid, Grid3x3, Smartphone, List, Zap, Image as ImageIcon, Sparkles } from "lucide-react";

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
}

export default function GaleriaToolbar({ state, onChange }: Props) {
  const set = (patch: Partial<ToolbarState>) => onChange({ ...state, ...patch });

  const viewBtn = (mode: ViewMode, Icon: typeof LayoutGrid, label: string) => {
    const active = state.view === mode;
    return (
      <button
        key={mode}
        onClick={() => set({ view: mode })}
        title={label}
        aria-label={label}
        className={`p-2 rounded-lg transition flex items-center justify-center
          ${active
            ? "bg-gradient-to-br from-[#2E7DD1] to-[#5BA4E5] text-white shadow"
            : "text-[#1A4A80] hover:bg-[#EFF5FF]"}`}>
        <Icon size={16} />
      </button>
    );
  };

  const qualityBtn = (q: Quality, Icon: typeof Zap, label: string) => {
    const active = state.quality === q;
    return (
      <button
        key={q}
        onClick={() => set({ quality: q })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
          ${active
            ? "bg-gradient-to-br from-[#2E7DD1] to-[#5BA4E5] text-white shadow"
            : "text-[#1A4A80] hover:bg-[#EFF5FF]"}`}>
        <Icon size={13} />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
      {/* Grupo: View modes */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
        {viewBtn("grid",    LayoutGrid, "Grade")}
        {viewBtn("compact", Grid3x3,    "Grade compacta")}
        {viewBtn("mobile",  Smartphone, "Coluna única")}
        {viewBtn("list",    List,       "Lista")}
      </div>

      {/* Grupo: Quality */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-100">
        {qualityBtn("rapido", Zap,        "Rápido")}
        {qualityBtn("normal", ImageIcon,  "Normal")}
        {qualityBtn("hd",     Sparkles,   "HD")}
      </div>

      {/* Slider de tamanho */}
      <div className="flex items-center gap-2 pl-2 min-w-[140px]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2E7DD1]/40" />
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={state.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="flex-1 accent-[#2E7DD1] cursor-pointer"
          aria-label="Tamanho dos thumbnails"
        />
        <span className="w-2.5 h-2.5 rounded-sm bg-[#2E7DD1]" />
      </div>
    </div>
  );
}
