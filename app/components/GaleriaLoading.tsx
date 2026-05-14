"use client";
import Image from "next/image";
import { Shield, ScanFace, Search, Sparkles } from "lucide-react";

interface Props {
  progresso?: number; // 0–100
  label?: string;
}

const STEPS = [
  { icon: Search,    label: "Buscando eventos"    },
  { icon: ScanFace,  label: "Analisando rostos"   },
  { icon: Sparkles,  label: "Encontrando você"    },
];

function stepFromLabel(label: string, progresso?: number): number {
  if (progresso !== undefined) return progresso < 30 ? 0 : progresso < 80 ? 1 : 2;
  const l = label.toLowerCase();
  if (l.includes("buscan") || l.includes("carregando") || l.includes("evento")) return 0;
  if (l.includes("analis") || l.includes("comparan") || l.includes("ia")) return 1;
  return 2;
}

export default function GaleriaLoading({ progresso, label = "Carregando fotos do evento" }: Props) {
  const currentStep = stepFromLabel(label, progresso);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #020b18 0%, #0D2B4E 55%, #1A4A80 100%)" }}
    >
      {/* Fundo sutil — reflexo de luz */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(46,125,209,0.12) 0%, transparent 70%)" }} />
      </div>

      <div className="relative flex flex-col items-center gap-10 z-10 px-6 w-full max-w-sm">

        {/* ── Orbital + logo ───────────────────────────────────── */}
        <div className="relative w-44 h-44 flex items-center justify-center">

          {/* Anel externo tracejado */}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/10 animate-spin-slow" />

          {/* Anel interno */}
          <div className="absolute inset-4 rounded-full border border-[#2E7DD1]/25" />

          {/* Ponto brilhante rápido */}
          <div className="absolute inset-0 animate-orbit-fast">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 rounded-full bg-[#5BA4E5] shadow-[0_0_14px_5px_rgba(91,164,229,0.65)]" />
            </div>
          </div>

          {/* Pontos orbitando devagar */}
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <div key={i} className="absolute inset-0 animate-orbit-slow"
              style={{ animationDelay: `${i * -1.4}s` }}>
              <div
                className="absolute top-0 left-1/2 rounded-full"
                style={{
                  width: i % 2 === 0 ? 8 : 6,
                  height: i % 2 === 0 ? 8 : 6,
                  backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.85)" : "rgba(91,164,229,0.6)",
                  boxShadow: i % 2 === 0 ? "0 0 6px 2px rgba(255,255,255,0.35)" : "none",
                  transform: `translateX(-50%) translateY(-50%) rotate(${deg}deg) translateY(-78px) rotate(-${deg}deg)`,
                }}
              />
            </div>
          ))}

          {/* Ícone */}
          <div className="relative z-10">
            <Image src="/logos/icon.png" alt="Contourline" width={76} height={76}
              className="brightness-200 drop-shadow-[0_0_18px_rgba(91,164,229,0.55)]" priority />
          </div>
        </div>

        {/* ── Título + label ───────────────────────────────────── */}
        <div className="text-center -mt-2">
          <h2 className="text-white text-2xl font-bold tracking-wide mb-1">
            Preparando sua galeria
          </h2>
          <p className="text-white/45 text-sm">{label}</p>
        </div>

        {/* ── Steps ────────────────────────────────────────────── */}
        <div className="flex w-full">
          {STEPS.map((s, i) => {
            const done   = i < currentStep;
            const active = i === currentStep;
            const Icon   = s.icon;
            return (
              <div key={i} className="flex-1 flex flex-col items-center relative">
                {/* Linha esquerda (até o centro deste step) */}
                {i > 0 && (
                  <div className="absolute top-[18px] left-0 right-1/2 h-px bg-white/10 overflow-hidden">
                    <div className={`h-full transition-all duration-700
                      ${done || active ? "w-full bg-emerald-500/50" : "w-0"}`} />
                  </div>
                )}
                {/* Linha direita (do centro até o próximo step) */}
                {i < STEPS.length - 1 && (
                  <div className="absolute top-[18px] left-1/2 right-0 h-px bg-white/10 overflow-hidden">
                    <div className={`h-full transition-all duration-700
                      ${done ? "w-full bg-emerald-500/50" : "w-0"}`} />
                  </div>
                )}
                {/* Ícone */}
                <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500
                  ${done   ? "bg-emerald-500/20 border border-emerald-500/40"
                  : active ? "bg-[#2E7DD1]/30 border border-[#5BA4E5]/60 shadow-[0_0_12px_rgba(91,164,229,0.4)]"
                  :          "bg-white/5 border border-white/10"}`}>
                  <Icon size={16} className={
                    done   ? "text-emerald-400"
                    : active ? "text-[#5BA4E5] animate-pulse"
                    :          "text-white/25"
                  } />
                </div>
                {/* Label */}
                <span className={`mt-2 text-[10px] font-semibold text-center leading-tight
                  ${done ? "text-emerald-400" : active ? "text-white/80" : "text-white/20"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Progresso ou dots ────────────────────────────────── */}
        {progresso !== undefined ? (
          <div className="w-full -mt-2">
            <div className="w-full bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
                style={{
                  width: `${progresso}%`,
                  background: "linear-gradient(90deg, #1A4A80, #2E7DD1, #5BA4E5)",
                }}
              >
                {/* Shimmer */}
                <div className="absolute inset-0 animate-shimmer"
                  style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", backgroundSize: "200% 100%" }} />
              </div>
            </div>
            <p className="text-[#5BA4E5] text-xs font-bold text-center mt-2 tabular-nums">{progresso}%</p>
          </div>
        ) : (
          <div className="flex gap-2 -mt-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#2E7DD1] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* ── Rodapé ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-white/25 text-[11px] -mt-2">
          <Shield size={12} />
          <span>Seus dados estão protegidos</span>
        </div>
      </div>
    </div>
  );
}
