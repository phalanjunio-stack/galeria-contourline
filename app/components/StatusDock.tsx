"use client";
/**
 * StatusDock — bolinha flutuante + painel expansível mostrando jobs ativos.
 * Inspirado no status-dock do sitelocal. Faz polling de /api/indexar/status pra cada job.
 *
 * - Bolinha com ring de progresso (oldest running)
 * - Hover/click expande painel acima com lista de jobs
 * - Drag pra reposicionar (persiste em localStorage)
 * - Sons swoosh ao expandir
 * - Glow azul/roxo igual chat do sitelocal
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertCircle, Loader2, ScanFace } from "lucide-react";
import {
  JOBS_EVENT, listJobs, oldestRunning, removeJob, updateJob, type JobLocal,
} from "@/lib/jobs";
import { playSound } from "@/lib/sounds";

const POS_KEY = "galeria-statusdock-pos";

const FASE_LABEL: Record<string, string> = {
  iniciando: "Iniciando",
  listando_fotos: "Listando fotos",
  recuperando_progresso: "Verificando progresso",
  detectando_rostos: "Detectando rostos",
  fazendo_matches: "Procurando você",
  salvando_matches: "Salvando",
  clusterizando: "Agrupando",
  salvando_pgvector: "Atualizando busca",
  notificando: "Notificando",
  concluido: "Concluído",
};

interface Pos { left: number; top: number; }

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function savePos(p: Pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
}

export default function StatusDock() {
  const [jobs, setJobs]       = useState<JobLocal[]>([]);
  const [open, setOpen]       = useState(false);
  const [pos,  setPos]        = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);

  const dockRef    = useRef<HTMLDivElement>(null);
  const dragStart  = useRef<{ x: number; y: number; pos: Pos } | null>(null);
  const dragMoved  = useRef(false);

  // Bootstrap: posição + lista inicial
  useEffect(() => {
    setPos(loadPos());
    setJobs(listJobs());
  }, []);

  // Escuta atualizações do localStorage (entre abas e mesma aba)
  useEffect(() => {
    function sync() { setJobs(listJobs()); }
    window.addEventListener(JOBS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(JOBS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Polling: pra cada job não-finalizado, consulta o status a cada 2s
  useEffect(() => {
    const runningJobs = jobs.filter(j => !j.finished);
    if (runningJobs.length === 0) return;

    let cancelled = false;
    async function tick() {
      for (const j of runningJobs) {
        if (cancelled) return;
        try {
          const r = await fetch(`/api/indexar/status?jobId=${encodeURIComponent(j.id)}`);
          if (!r.ok) {
            // Job sumiu — marca como erro
            if (r.status === 404) {
              updateJob(j.id, {
                finished: true,
                lastStatus: { status: "error", pct: 0, erro: "Job não encontrado", updatedAt: Date.now() },
              });
            }
            continue;
          }
          const data = await r.json();
          const total = data.fotosTotal || 0;
          const proc  = data.fotosProcessadas || 0;
          const pct = total > 0 ? Math.round((proc / total) * 100) : 0;
          const status: "running" | "done" | "error" =
            data.status === "done" ? "done" :
            data.status === "error" ? "error" : "running";

          updateJob(j.id, {
            lastStatus: {
              status,
              fase: data.fase,
              pct,
              fotosProcessadas: proc,
              fotosTotal: total,
              rostosDetectados: data.rostosDetectados,
              matches: data.matches,
              erro: data.erro,
              updatedAt: Date.now(),
            },
            finished: status !== "running",
          });

          // Som de conclusão
          if (status === "done" && !j.finished) playSound("ding");
        } catch {
          // Silencia erros de polling
        }
      }
    }
    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [jobs]);

  // ── Drag ────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      pos: { left: rect.left, top: rect.top },
    };
    dragMoved.current = false;
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        dragMoved.current = true;
        setDragging(true);
        setOpen(false);
        const w = dockRef.current?.offsetWidth ?? 64;
        const h = dockRef.current?.offsetHeight ?? 64;
        const newLeft = Math.max(8, Math.min(window.innerWidth  - w - 8, dragStart.current.pos.left + dx));
        const newTop  = Math.max(8, Math.min(window.innerHeight - h - 8, dragStart.current.pos.top  + dy));
        setPos({ left: newLeft, top: newTop });
      }
    }
    function onUp() {
      if (dragMoved.current && pos) savePos(pos);
      dragStart.current = null;
      setTimeout(() => setDragging(false), 50);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [pos]);

  // Não renderiza se não tem jobs
  if (jobs.length === 0) return null;

  const oldest = oldestRunning() ?? jobs[jobs.length - 1];
  const oldestPct = oldest?.lastStatus?.pct ?? 0;
  const oldestState = oldest?.lastStatus?.status ?? "running";
  const isFlipped = pos ? pos.top < window.innerHeight / 2 : false;

  // Posição default: bottom-right
  const defaultStyle = !pos
    ? { right: 24, bottom: 24 }
    : { left: pos.left, top: pos.top };

  // ── Ring SVG ────────────────────────────────────────────────────────────
  const SIZE = 64, STROKE = 4, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
  const offset = C - (oldestPct / 100) * C;
  const ringColor =
    oldestState === "done"      ? "url(#sg-grad-done)"   :
    oldestState === "error"     ? "url(#sg-grad-err)"    :
    oldestState === "cancelled" ? "url(#sg-grad-warn)"   :
                                  "url(#sg-grad-run)";

  return (
    <div
      ref={dockRef}
      className="fixed z-[9500]"
      style={{ ...defaultStyle, cursor: dragging ? "grabbing" : "default" }}
    >
      {/* ─── Painel expandido ─── */}
      <AnimatePresence>
        {open && !dragging && (
          <motion.div
            initial={{ opacity: 0, y: isFlipped ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,                       scale: 1    }}
            exit={{    opacity: 0, y: isFlipped ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glow-active absolute w-[340px] rounded-2xl"
            style={{
              [isFlipped ? "top" : "bottom"]: 76,
              left: "50%",
              transform: "translateX(-50%)",
            }}
            onMouseEnter={() => setOpen(true)}
          >
          {/* Inner com overflow:hidden + bg dark */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(13,43,78,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(91,164,229,0.25)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "rgba(91,164,229,0.15)" }}>
              <div className="flex items-center gap-2">
                <ScanFace size={14} className="text-[#5BA4E5]" />
                <span className="text-white text-sm font-bold">Processos</span>
                <span className="text-xs text-white/40">{jobs.length}</span>
              </div>
            </div>

            {/* Lista de jobs */}
            <div className="max-h-[320px] overflow-y-auto">
              {jobs.map((j) => {
                const s = j.lastStatus;
                const pct = s?.pct ?? 0;
                const stt = s?.status ?? "running";
                const fase = s?.fase ? FASE_LABEL[s.fase] || s.fase : "Iniciando";
                const isDone = stt === "done";
                const isErr  = stt === "error";

                return (
                  <div key={j.id} className="px-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: "rgba(91,164,229,0.08)" }}>

                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isDone ? <Check size={13} className="text-emerald-400 shrink-0" />
                         : isErr ? <AlertCircle size={13} className="text-red-400 shrink-0" />
                         : <Loader2 size={13} className="text-[#5BA4E5] shrink-0 animate-spin" />}
                        <p className="text-white text-xs font-semibold truncate">{j.label}</p>
                      </div>
                      {j.finished && (
                        <button
                          onClick={(e) => { e.stopPropagation(); playSound("tap"); removeJob(j.id); }}
                          className="w-5 h-5 rounded-md hover:bg-white/10 flex items-center justify-center shrink-0"
                          title="Fechar"
                        >
                          <X size={11} className="text-white/50" />
                        </button>
                      )}
                    </div>

                    {/* Barra de progresso com shine */}
                    <div className="relative h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.08)" }}>
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        style={{
                          background: isDone
                            ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                            : isErr
                            ? "linear-gradient(90deg, #ef4444 0%, #f87171 100%)"
                            : "linear-gradient(90deg, #169bff 0%, #36d9ff 55%, #7957ff 100%)",
                          boxShadow: isDone
                            ? "0 0 10px rgba(16,185,129,0.5)"
                            : isErr
                            ? "0 0 10px rgba(239,68,68,0.5)"
                            : "0 0 10px rgba(54,217,255,0.5)",
                        }}
                      >
                        {!isDone && !isErr && (
                          <div className="absolute inset-0 opacity-50"
                            style={{
                              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                              animation: "shimmer 1.4s linear infinite",
                              backgroundSize: "200% 100%",
                            }} />
                        )}
                      </motion.div>
                    </div>

                    {/* Detalhes */}
                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span className="text-white/50">{fase}</span>
                      <span className="text-white font-bold">
                        {s?.fotosTotal
                          ? `${s.fotosProcessadas}/${s.fotosTotal} · ${pct}%`
                          : `${pct}%`}
                      </span>
                    </div>

                    {s?.matches !== undefined && s.matches > 0 && (
                      <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                        ✨ {s.matches} pessoa{s.matches > 1 ? "s" : ""} encontrada{s.matches > 1 ? "s" : ""}
                      </p>
                    )}
                    {isErr && s?.erro && (
                      <p className="text-[10px] text-red-400 mt-1 truncate">{s.erro}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>{/* /inner */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bolinha (peek) ─── */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => {
          if (!dragging && !dragStart.current) {
            if (!open) playSound("open");
            setOpen(true);
          }
        }}
        onMouseLeave={(e) => {
          // Mantém aberto se mouse foi pro painel
          const next = e.relatedTarget as HTMLElement | null;
          if (next && dockRef.current?.contains(next)) return;
          setOpen(false);
        }}
        onClick={(e) => {
          if (dragMoved.current) { e.preventDefault(); return; }
          setOpen((v) => !v);
        }}
        className="relative flex items-center justify-center select-none"
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #3B9AFF 0%, #1565D8 55%, #0A3D8F 100%)",
          border: "1px solid rgba(124,196,255,0.5)",
          boxShadow:
            "0 4px 16px rgba(31,139,255,0.45), 0 0 28px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        {/* SVG ring */}
        <svg width={SIZE} height={SIZE} className="absolute inset-0 pointer-events-none">
          <defs>
            <linearGradient id="sg-grad-run" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#36d9ff" />
              <stop offset="55%"  stopColor="#169bff" />
              <stop offset="100%" stopColor="#7957ff" />
            </linearGradient>
            <linearGradient id="sg-grad-done" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="sg-grad-err" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f87171" />
            </linearGradient>
            <linearGradient id="sg-grad-warn" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id="sg-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
            fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} />
          {/* Progress */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
            fill="none" stroke={ringColor} strokeWidth={STROKE}
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
            filter="url(#sg-glow)"
            style={{
              transform: "rotate(-90deg)", transformOrigin: "center",
              transition: "stroke-dashoffset .5s ease",
            }} />
        </svg>

        {/* Centro: % ou ícone */}
        <div className="relative z-10 text-white font-extrabold text-[15px] leading-none flex items-center justify-center">
          {oldestState === "done"  ? <Check size={22} strokeWidth={3} />
          : oldestState === "error" ? <X size={22} strokeWidth={3} />
          : (
            <span>
              {oldestPct}
              <span className="text-[9px] align-super ml-0.5">%</span>
            </span>
          )}
        </div>
      </motion.button>
    </div>
  );
}
