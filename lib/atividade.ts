import fs from "node:fs/promises";
import path from "node:path";

const ATIVIDADE_PATH = path.join(process.cwd(), "data", "atividade.json");
const MAX_ATIVIDADES = 1000;

export interface Atividade {
  ts: string;
  tipo: string;
  email?: string;
  nome?: string;
  detalhes?: Record<string, unknown>;
}

async function lerArquivo(): Promise<Atividade[]> {
  try {
    const raw = await fs.readFile(ATIVIDADE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function salvarArquivo(lista: Atividade[]) {
  await fs.mkdir(path.dirname(ATIVIDADE_PATH), { recursive: true });
  await fs.writeFile(ATIVIDADE_PATH, JSON.stringify(lista.slice(0, MAX_ATIVIDADES), null, 2), "utf-8");
}

export async function listarAtividades({ limite = 200, tipo }: { limite?: number; tipo?: string | null } = {}) {
  const lista = await lerArquivo();
  const filtrada = tipo ? lista.filter((item) => item.tipo === tipo) : lista;
  return filtrada.slice(0, Math.max(1, Math.min(limite, MAX_ATIVIDADES)));
}

export async function registrarAtividade(input: Omit<Atividade, "ts"> & { ts?: string }) {
  try {
    const atual = await lerArquivo();
    const novo: Atividade = {
      ts: input.ts ?? new Date().toISOString(),
      tipo: input.tipo,
      email: input.email,
      nome: input.nome,
      detalhes: input.detalhes,
    };
    await salvarArquivo([novo, ...atual]);
  } catch (err) {
    console.warn("[atividade] falha ao registrar:", err);
  }
}
