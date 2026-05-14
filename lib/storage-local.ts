// Leitura de arquivos de descritores/matches salvos localmente pelo servidor Node.
// Usado como fallback quando o arquivo não está no Drive (403 na pasta compartilhada).
// Caminho local: ../data/descritores/{folderId}/{fileName}
// (relativo à raiz do projeto Next.js — resolve com process.cwd())
import fs from "node:fs/promises";
import path from "node:path";

const BASE = path.resolve(process.cwd(), "data", "descritores");

interface EventoBasico {
  id: string;
  folder_id?: string;
}

/** Retorna o folderId do Drive para um dado eventoId, lendo eventos.json. */
async function getFolderId(eventoId: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), "data", "eventos.json"),
      "utf-8"
    );
    const eventos: EventoBasico[] = JSON.parse(raw);
    return eventos.find((e) => e.id === eventoId)?.folder_id ?? null;
  } catch {
    return null;
  }
}

/** Lê um arquivo JSON do disco local. Retorna null se não existir. */
export async function lerDescritoresLocal<T>(
  eventoId: string,
  fileName: string
): Promise<T | null> {
  const folderId = await getFolderId(eventoId);
  if (!folderId) return null;

  try {
    const filePath = path.join(BASE, folderId, fileName);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
