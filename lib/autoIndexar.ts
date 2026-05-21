/**
 * Helper pra disparar indexação automaticamente em eventos que ainda não foram indexados.
 * Usado quando o usuário entra em /resultado e queremos garantir que ele tenha resultados.
 *
 * Estratégia:
 * 1. Recebe lista de eventos ativos
 * 2. Pra cada um, checa se já tem descritores via /api/descritores?eventoId=...
 * 3. Pros que NÃO têm, dispara /api/indexar/iniciar e registra no localStorage
 *    pra StatusDock pegar
 * 4. Cooldown local de 5min por evento pra não martelar o servidor
 */

import { addJob, listJobs } from "./jobs";

const COOLDOWN_LOCAL_MS = 5 * 60_000; // 5 minutos
const ULTIMA_TENTATIVA_KEY = "galeria-auto-index-tentativas";

interface EventoMin {
  id: string;
  nome: string;
  folder_id?: string | null;
}

interface TentativasMap { [eventoId: string]: number }

function lerTentativas(): TentativasMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(ULTIMA_TENTATIVA_KEY) || "{}"); } catch { return {}; }
}

function salvarTentativa(eventoId: string) {
  try {
    const t = lerTentativas();
    t[eventoId] = Date.now();
    localStorage.setItem(ULTIMA_TENTATIVA_KEY, JSON.stringify(t));
  } catch {}
}

async function temIndexacao(eventoId: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/descritores?eventoId=${encodeURIComponent(eventoId)}`);
    if (!r.ok) return false;
    const data = await r.json();
    return !!(data?.indexado && Array.isArray(data.dados) && data.dados.length > 0);
  } catch {
    return false;
  }
}

export interface AutoIndexResult {
  total: number;        // eventos ativos
  indexados: number;    // já tinham indexação
  disparados: number;   // novos jobs iniciados agora
  cooldown: number;     // pulados por cooldown local
  jaRodando: number;    // pulados porque já têm job rodando
}

/**
 * Para cada evento sem indexação, dispara /api/indexar/iniciar (com cooldown local).
 * Retorna estatísticas pra UI mostrar.
 */
export async function autoIndexarEventos(eventos: EventoMin[]): Promise<AutoIndexResult> {
  const result: AutoIndexResult = {
    total: eventos.length,
    indexados: 0,
    disparados: 0,
    cooldown: 0,
    jaRodando: 0,
  };

  const ativos = eventos.filter(e => e.folder_id);
  const tentativas = lerTentativas();
  const now = Date.now();

  // Eventos com job já rodando — não disparar de novo
  const jobsAtivos = new Set(listJobs().filter(j => !j.finished && j.eventoId).map(j => j.eventoId));

  // Roda checagens em paralelo (rápido)
  await Promise.all(ativos.map(async (ev) => {
    // Já tem job rodando?
    if (jobsAtivos.has(ev.id)) {
      result.jaRodando++;
      return;
    }
    // Cooldown local
    const ultima = tentativas[ev.id] || 0;
    if (now - ultima < COOLDOWN_LOCAL_MS) {
      result.cooldown++;
      return;
    }
    // Já tem indexação?
    const indexed = await temIndexacao(ev.id);
    if (indexed) {
      result.indexados++;
      return;
    }
    // Dispara
    try {
      const res = await fetch("/api/indexar/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: ev.id,
          eventoNome: ev.nome,
          folderId: ev.folder_id,
        }),
      });
      if (!res.ok) {
        // 429 cooldown servidor — marca local pra não tentar de novo já
        salvarTentativa(ev.id);
        return;
      }
      const data = await res.json();
      if (data.jobId) {
        addJob({
          id: data.jobId,
          kind: "indexar",
          label: `Indexando: ${ev.nome}`,
          eventoId: ev.id,
          eventoNome: ev.nome,
          folderId: ev.folder_id || undefined,
          startedAt: Date.now(),
          lastStatus: { status: "running", pct: 0, fase: "iniciando", updatedAt: Date.now() },
        });
        salvarTentativa(ev.id);
        result.disparados++;
      }
    } catch {
      salvarTentativa(ev.id);
    }
  }));

  return result;
}
