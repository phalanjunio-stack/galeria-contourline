/**
 * Helper client-side pra gerenciar jobs de indexação em background.
 * Persiste em localStorage e dispara eventos pra StatusDock reagir.
 */

const STORAGE_KEY = "galeria-jobs-v1";
export const JOBS_EVENT = "galeria-jobs-update";

export type JobKind = "indexar" | "upload" | "outro";

export interface JobLocal {
  id: string;           // jobId do servidor
  kind: JobKind;
  label: string;        // "Indexando: Casamento João + Maria"
  eventoId?: string;
  eventoNome?: string;
  folderId?: string;
  startedAt: number;
  // Cache do último status pra render imediato
  lastStatus?: {
    status: "running" | "done" | "error" | "cancelled";
    fase?: string;
    pct: number;       // 0..100
    fotosProcessadas?: number;
    fotosTotal?: number;
    rostosDetectados?: number;
    matches?: number;
    erro?: string | null;
    updatedAt: number;
  };
  /** Quando concluído/falhou, mantém visível pra usuário fechar */
  finished?: boolean;
}

export type JobsMap = Record<string, JobLocal>;

export function readJobs(): JobsMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeJobs(jobs: JobsMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    window.dispatchEvent(new CustomEvent(JOBS_EVENT));
  } catch {}
}

export function addJob(job: JobLocal) {
  const jobs = readJobs();
  jobs[job.id] = job;
  writeJobs(jobs);
}

export function updateJob(id: string, patch: Partial<JobLocal>) {
  const jobs = readJobs();
  if (!jobs[id]) return;
  jobs[id] = { ...jobs[id], ...patch };
  writeJobs(jobs);
}

export function removeJob(id: string) {
  const jobs = readJobs();
  delete jobs[id];
  writeJobs(jobs);
}

export function listJobs(): JobLocal[] {
  return Object.values(readJobs()).sort((a, b) => a.startedAt - b.startedAt);
}

export function oldestRunning(): JobLocal | null {
  return listJobs().find((j) => !j.finished) ?? null;
}
