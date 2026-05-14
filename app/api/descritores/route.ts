import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface RostoFoto {
  descriptor: number[]; // vetor 128-D
}

export interface FotoDescritores {
  fotoId: string;
  rostos: RostoFoto[];
}

function nomeArquivo(eventoId: string) {
  // _desc_<eventoId>.json — começa com _ para não aparecer na listagem de fotos
  return `_desc_${eventoId}.json`;
}

/**
 * GET /api/descritores?eventoId=xxx
 * Retorna os descritores pré-computados de um evento.
 * Acessível por qualquer usuário (dados são anônimos — sem email).
 */
export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId)
    return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  const session = await auth();
  // Service account primeiro — token OAuth pode expirar; service account gera token sempre fresco
  const token   = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

  try {
    let dados = await lerArquivoOculto<FotoDescritores[]>(ROOT, nomeArquivo(eventoId), token);
    // Fallback: servidor local salva em data/descritores/ quando Drive retorna 403
    if (!dados) dados = await lerDescritoresLocal<FotoDescritores[]>(eventoId, nomeArquivo(eventoId));
    if (!dados) return NextResponse.json({ indexado: false, dados: [] });
    return NextResponse.json({ indexado: true, total: dados.length, dados });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/descritores
 * Salva os descritores computados pelo admin para um evento.
 * Body: { eventoId: string, dados: FotoDescritores[] }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { eventoId, dados } = body as { eventoId: string; dados: FotoDescritores[] };

  if (!eventoId || !Array.isArray(dados))
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

  try {
    await salvarArquivoOculto(ROOT, nomeArquivo(eventoId), dados, token);
    return NextResponse.json({ ok: true, total: dados.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
