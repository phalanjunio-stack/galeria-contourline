// Cache local de eventos — serve como fallback quando o Drive não está acessível
// Os dados ficam em /data/eventos.json no servidor

import fs from "fs";
import path from "path";
import type { EventoItem } from "@/app/api/eventos/route";

const FILE = path.join(process.cwd(), "data", "eventos.json");

function garantirArquivo() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]", "utf-8");
}

export function lerEventosLocal(): EventoItem[] {
  try {
    garantirArquivo();
    const raw = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(raw) as EventoItem[];
  } catch {
    return [];
  }
}

export function salvarEventosLocal(eventos: EventoItem[]) {
  try {
    garantirArquivo();
    fs.writeFileSync(FILE, JSON.stringify(eventos, null, 2), "utf-8");
  } catch { /* ignora erro de escrita */ }
}
