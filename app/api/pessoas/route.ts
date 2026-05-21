import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";
import { lerClustersDoEventoDb } from "@/lib/face-index-db";
import type { ClusterPessoa } from "@/lib/clustering";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface PessoasDoEvento {
  eventoId:     string;
  eventoNome?:  string;
  processadoEm: string;
  threshold:    number;       // threshold usado na clusterização
  clusters:     ClusterPessoa[];
}

function chave(eventoId: string) {
  return `_pessoas_${eventoId}.json`;
}

/**
 * GET /api/pessoas?eventoId=X
 * Lê clusters de pessoas detectadas no evento.
 */
export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  try {
    const clustersDb = await lerClustersDoEventoDb(eventoId);
    if (clustersDb?.length) {
      return NextResponse.json({
        eventoId,
        processadoEm: new Date().toISOString(),
        threshold: 0.50,
        clusters: clustersDb,
        indexado: true,
        source: "pgvector",
      });
    }
  } catch (err) {
    console.warn("[pessoas] leitura pgvector falhou, usando fallback:", err);
  }

  const session = await auth();
  const token   = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ clusters: [], indexado: false }, { status: 200 });

  try {
    let data = await lerArquivoOculto<PessoasDoEvento>(ROOT, chave(eventoId), token);
    // Fallback: servidor local salva em data/descritores/ quando Drive retorna 403
    if (!data) data = await lerDescritoresLocal<PessoasDoEvento>(eventoId, chave(eventoId));
    if (!data) return NextResponse.json({ clusters: [], indexado: false });
    return NextResponse.json({ ...data, indexado: true });
  } catch {
    return NextResponse.json({ clusters: [], indexado: false });
  }
}

/**
 * POST /api/pessoas
 * Salva clusters do evento (chamado pelo admin no fim da indexação).
 * Body: { eventoId, eventoNome?, clusters, threshold }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  const body = await req.json();
  const { eventoId, eventoNome, clusters, threshold } = body as {
    eventoId:   string;
    eventoNome?: string;
    clusters:   ClusterPessoa[];
    threshold?: number;
  };
  if (!eventoId || !Array.isArray(clusters)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const data: PessoasDoEvento = {
    eventoId,
    eventoNome,
    processadoEm: new Date().toISOString(),
    threshold:    threshold ?? 0.50,
    clusters,
  };

  try {
    await salvarArquivoOculto(ROOT, chave(eventoId), data, token);
    return NextResponse.json({ ok: true, totalClusters: clusters.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
