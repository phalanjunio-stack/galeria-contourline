import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerEventosLocal, salvarEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

// GET /api/admin/backup — exporta eventos como JSON
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const source = req.nextUrl.searchParams.get("source") ?? "auto";

  let eventos: EventoItem[] = [];
  let from = source === "drive" ? "drive" : "local";

  if (source !== "local") {
    const token = session.accessToken ?? await getAccessTokenFromEnv();
    if (!token && source === "drive") {
      return NextResponse.json({ error: "Token do Drive indisponível" }, { status: 503 });
    }
    if (token) {
      try {
        const fromDrive = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
        if (fromDrive) {
          eventos = fromDrive;
          from = "drive";
        }
      } catch (err) {
        if (source === "drive") {
          return NextResponse.json({ error: `Falha ao ler Drive: ${String(err)}` }, { status: 502 });
        }
      }
    }
  }

  if (source !== "drive" && !eventos.length) {
    eventos = lerEventosLocal();
    from = "local";
  }

  return NextResponse.json({ eventos, from, total: eventos.length, ts: new Date().toISOString() });
}

// POST /api/admin/backup — restaura eventos a partir de JSON enviado no body
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Aceita { eventos: [...] } ou direto [...]
  const lista: EventoItem[] = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown>).eventos)
      ? ((body as Record<string, unknown>).eventos as EventoItem[])
      : [];

  if (!lista.length) {
    return NextResponse.json({ error: "Nenhum evento encontrado no payload" }, { status: 400 });
  }

  // Salva local (sempre)
  salvarEventosLocal(lista);

  // Salva no Drive
  const token = session.accessToken ?? await getAccessTokenFromEnv();
  let savedDrive = false;
  if (token) {
    try {
      await salvarArquivoOculto(ROOT_FOLDER, "_index.json", lista, token);
      savedDrive = true;
    } catch { /**/ }
  }

  return NextResponse.json({ ok: true, total: lista.length, savedLocal: true, savedDrive });
}
