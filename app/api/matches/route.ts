import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";

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
    let data = await lerArquivoOculto<ResultadoIndexacao>(ROOT, nomeArquivo(eventoId), token);
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
