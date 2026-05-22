import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";
import { lerEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface MatchUsuarioSalvo {
  email: string;
  nome: string;
  fotosIds: string[];
  thumbUrl?: string;
}

export interface ResultadoIndexacao {
  eventoId: string;
  eventoNome: string;
  processadoEm: string;
  totalFotos: number;
  fotosComRosto: number;
  usuarios: MatchUsuarioSalvo[];
}

function nomeArquivo(eventoId: string) {
  return `_matches_${eventoId}.json`;
}

async function lerPastaEvento(eventoId: string, token: string) {
  if (ROOT) {
    try {
      const eventos = await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token);
      const folderId = eventos?.find((evento) => evento.id === eventoId)?.folder_id;
      if (folderId) return folderId;
    } catch {
      // Usa cache local se o catalogo do Drive estiver indisponivel.
    }
  }
  return lerEventosLocal().find((evento) => evento.id === eventoId)?.folder_id ?? null;
}

async function lerMatchesDrive(eventoId: string, token: string) {
  const fileName = nomeArquivo(eventoId);
  const folderId = await lerPastaEvento(eventoId, token);
  const folders = [...new Set([folderId, ROOT].filter(Boolean))] as string[];

  for (const folder of folders) {
    const data = await lerArquivoOculto<ResultadoIndexacao>(folder, fileName, token).catch(() => null);
    if (data) return data;
  }
  return null;
}

/** GET /api/matches?eventoId=xxx — lê resultado salvo */
export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) return NextResponse.json(null);

  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  // Service account primeiro — gera token sempre fresco; OAuth pode ter expirado
  const token   = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json(null);

  try {
    let data = await lerMatchesDrive(eventoId, token);
    // Fallback: servidor local salva em data/descritores/ quando Drive retorna 403
    if (!data) data = await lerDescritoresLocal<ResultadoIndexacao>(eventoId, nomeArquivo(eventoId));
    return NextResponse.json(data ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

/** POST /api/matches — salva resultado (admin only) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body: ResultadoIndexacao = await req.json();
  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

  try {
    await salvarArquivoOculto(ROOT, nomeArquivo(body.eventoId), body, token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
