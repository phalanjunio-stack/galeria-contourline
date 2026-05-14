import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const FLAGS_PATH = path.join(process.cwd(), "data", "reindex_flags.json");

export interface ReindexFlag {
  eventoId:   string;
  eventoNome: string;
  fotosIndex: number; // fotos no índice na última checagem
  fotosTotal: number; // fotos no Drive na última checagem
  novas:      number; // fotosTotal - fotosIndex
  detectadoEm: string;
}

function lerFlags(): ReindexFlag[] {
  try {
    if (fs.existsSync(FLAGS_PATH)) return JSON.parse(fs.readFileSync(FLAGS_PATH, "utf-8"));
  } catch { /**/ }
  return [];
}

function salvarFlags(flags: ReindexFlag[]) {
  try { fs.writeFileSync(FLAGS_PATH, JSON.stringify(flags, null, 2), "utf-8"); } catch { /**/ }
}

// GET — lista flags pendentes (admin)
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return NextResponse.json(lerFlags());
}

// DELETE ?eventoId=X — limpa flag após reindexar
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  const flags = lerFlags().filter(f => f.eventoId !== eventoId);
  salvarFlags(flags);
  return NextResponse.json({ ok: true });
}

// POST — cron escreve flags (protegido por CRON_SECRET)
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.replace("Bearer ", "").trim();
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const novas: ReindexFlag[] = await req.json();
  const existentes = lerFlags();
  // Merge: atualiza se já existe flag para o evento, senão adiciona
  const map = new Map(existentes.map(f => [f.eventoId, f]));
  novas.forEach(f => map.set(f.eventoId, f));
  salvarFlags(Array.from(map.values()));
  return NextResponse.json({ ok: true, total: map.size });
}
