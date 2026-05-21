"use client";
/**
 * Botão "Indexar este evento" — público.
 * Dispara face indexing no servidor remoto e registra o job no StatusDock.
 */
import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { addJob, listJobs } from "@/lib/jobs";
import { playSound } from "@/lib/sounds";

interface Props {
  eventoId: string;
  eventoNome: string;
  folderId: string;
  totalFotos: number;
}

export default function IndexarEventoButton({ eventoId, eventoNome, folderId, totalFotos }: Props) {
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // Verifica se já tem um job rodando pra esse evento
  const jaIndexando = listJobs().some(
    (j) => j.eventoId === eventoId && !j.finished
  );

  async function iniciar() {
    if (loading || jaIndexando) return;
    setLoading(true);
    setMensagem(null);
    playSound("tap");

    try {
      const res = await fetch("/api/indexar/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, eventoNome, folderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMensagem(data.error || "Erro ao iniciar indexação");
        setTimeout(() => setMensagem(null), 4000);
        return;
      }

      // Registra job no localStorage — o StatusDock vai detectar via evento
      addJob({
        id: data.jobId,
        kind: "indexar",
        label: `Indexando: ${eventoNome}`,
        eventoId,
        eventoNome,
        folderId,
        startedAt: Date.now(),
        lastStatus: { status: "running", pct: 0, fase: "iniciando", updatedAt: Date.now() },
      });

      playSound("ding");
      setMensagem("Indexação iniciada — acompanhe na bolinha 👇");
      setTimeout(() => setMensagem(null), 3500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setMensagem(msg);
      setTimeout(() => setMensagem(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || jaIndexando;

  return (
    <div className="relative">
      <div className={jaIndexando ? "glow-active rounded-xl inline-block" : "inline-block"}>
      <motion.button
        whileHover={!disabled ? { y: -1 } : undefined}
        whileTap={!disabled ? { scale: 0.97 } : undefined}
        onClick={iniciar}
        disabled={disabled}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 relative overflow-hidden"
        style={{
          background: jaIndexando
            ? "linear-gradient(135deg, #0d2b4e 0%, #1a4a80 100%)"
            : "linear-gradient(135deg, #0D2B4E 0%, #1565D8 100%)",
          border: "1px solid rgba(91,164,229,0.4)",
          boxShadow: jaIndexando
            ? "0 0 12px rgba(91,164,229,0.25)"
            : "0 4px 16px rgba(46,125,209,0.35), 0 0 24px rgba(46,125,209,0.2)",
          opacity: disabled ? 0.85 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {loading
          ? <Loader2 size={16} className="animate-spin" />
          : <Globe size={16} />}
        <span>
          {jaIndexando ? "Indexando..." : "Indexar"}
          <span className="ml-1.5 opacity-70 font-medium">
            ({totalFotos} {totalFotos === 1 ? "foto" : "fotos"})
          </span>
        </span>

        {/* Shine sweep — só quando ativo */}
        {!disabled && (
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
              transform: "translateX(-100%)",
              animation: "btn-shine 3.5s ease-in-out infinite",
            }}
          />
        )}
      </motion.button>
      </div>

      {/* Toast inline */}
      {mensagem && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-10"
          style={{
            background: "rgba(13,43,78,0.95)",
            color: "#fff",
            border: "1px solid rgba(91,164,229,0.3)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {mensagem}
        </motion.div>
      )}

      <style jsx>{`
        @keyframes btn-shine {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(120%);  }
          100% { transform: translateX(120%);  }
        }
      `}</style>
    </div>
  );
}
