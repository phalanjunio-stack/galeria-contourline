import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";
import type { EventoItem } from "@/app/api/eventos/route";
import {
  faceIndexDbEnabled,
  lerAmostraRostosIndexadosDb,
  type FaceIndexPreview,
  type FaceIndexPreviewFace,
} from "@/lib/face-index-db";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

type RostoDescritor = {
  box?: { x?: number; y?: number; width?: number; height?: number };
  score?: number;
};

type FotoDescritores = {
  fotoId: string;
  rostos?: RostoDescritor[];
};

type PreviewFaceServer = {
  found?: boolean;
  totalFotos?: number;
  fotosComRosto?: number;
  rostosDetectados?: number;
  fotos?: {
    fotoId: string;
    rostos?: (RostoDescritor & { ordem?: number })[];
  }[];
};

function cropUrl(fotoId: string, rosto: RostoDescritor) {
  const box = rosto.box;
  if (
    !box ||
    typeof box.x !== "number" ||
    typeof box.y !== "number" ||
    typeof box.width !== "number" ||
    typeof box.height !== "number"
  ) {
    return null;
  }

  const params = new URLSearchParams({
    fotoId,
    x: String(box.x),
    y: String(box.y),
    width: String(box.width),
    height: String(box.height),
  });
  return `/api/indexacao/rostos/crop?${params}`;
}

function criarPreviewDescritores(
  eventoId: string,
  dados: FotoDescritores[],
  totais?: { totalFotos?: number; fotosComRosto?: number; rostosDetectados?: number }
) {
  if (!Array.isArray(dados) || dados.length === 0) return null;

  const fotos = dados
    .filter((foto) => Array.isArray(foto.rostos) && foto.rostos.length > 0)
    .slice(-12)
    .reverse()
    .map((foto) => ({
      fotoId: foto.fotoId,
      rostos: (foto.rostos ?? [])
        .map((rosto, ordem) => {
          const url = cropUrl(foto.fotoId, rosto);
          if (!url) return null;
          return {
            id: `${foto.fotoId}:${ordem}`,
            ordem,
            score: typeof rosto.score === "number" ? rosto.score : null,
            cropUrl: url,
          } satisfies FaceIndexPreviewFace;
        })
        .filter((rosto): rosto is FaceIndexPreviewFace => rosto !== null),
    }))
    .filter((foto) => foto.rostos.length > 0);
  if (fotos.length === 0) return null;

  return {
    eventoId,
    eventoNome: eventoId,
    totalFotos: totais?.totalFotos ?? dados.length,
    fotosComRosto: totais?.fotosComRosto ?? dados.filter((foto) => (foto.rostos?.length ?? 0) > 0).length,
    rostosDetectados: totais?.rostosDetectados ?? dados.reduce((total, foto) => total + (foto.rostos?.length ?? 0), 0),
    indexedAt: new Date().toISOString(),
    fotos,
  } satisfies FaceIndexPreview;
}

async function lerPreviewFaceServer(eventoId: string, folderId?: string) {
  const serverUrl = process.env.FACE_SERVER_URL;
  if (!serverUrl) return null;

  const serverSecret = process.env.FACE_SERVER_SECRET;
  const params = new URLSearchParams();
  if (folderId) params.set("folderId", folderId);
  const res = await fetch(`${serverUrl}/preview/${encodeURIComponent(eventoId)}?${params}`, {
    headers: serverSecret ? { "X-Server-Secret": serverSecret } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json() as PreviewFaceServer;
  if (!data.found || !Array.isArray(data.fotos)) return null;

  const dados = data.fotos.map((foto) => ({
    fotoId: foto.fotoId,
    rostos: foto.rostos ?? [],
  }));
  return criarPreviewDescritores(eventoId, dados, {
    totalFotos: data.totalFotos,
    fotosComRosto: data.fotosComRosto,
    rostosDetectados: data.rostosDetectados,
  });
}

async function lerPreviewDescritores(eventoId: string, folderId?: string): Promise<FaceIndexPreview | null> {
  const fileName = `_desc_${eventoId}.json`;
  const token = await getAccessTokenFromEnv();
  let dados: FotoDescritores[] | null = null;

  if (token && ROOT) {
    const folders = [...new Set([folderId, ROOT].filter(Boolean))] as string[];
    for (const folder of folders) {
      try {
        dados = await lerArquivoOculto<FotoDescritores[]>(folder, fileName, token);
      } catch { /* tenta proxima origem */ }
      if (dados) break;
    }
  }
  if (!dados) {
    dados = await lerDescritoresLocal<FotoDescritores[]>(eventoId, fileName);
  }
  return dados ? criarPreviewDescritores(eventoId, dados) : null;
}

async function lerPreviewPgvector(eventoId: string) {
  if (!faceIndexDbEnabled()) return null;

  try {
    return await lerAmostraRostosIndexadosDb(eventoId);
  } catch (err) {
    console.warn("[indexacao/rostos] Pgvector da galeria indisponivel, tentando face-server:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ error: "eventoId obrigatorio" }, { status: 400 });
  }
  try {
    const token = await getAccessTokenFromEnv();
    const eventos = token && ROOT
      ? await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token).catch(() => null)
      : null;
    const folderId = eventos?.find((evento) => evento.id === eventoId)?.folder_id;
    const previewDb = await lerPreviewPgvector(eventoId);
    if (previewDb) {
      return NextResponse.json({ enabled: true, source: "pgvector", preview: previewDb });
    }

    const previewServer = await lerPreviewFaceServer(eventoId, folderId);
    if (previewServer) {
      return NextResponse.json({ enabled: faceIndexDbEnabled(), source: "face-server", preview: previewServer });
    }

    const previewDrive = await lerPreviewDescritores(eventoId, folderId);
    return NextResponse.json({
      enabled: faceIndexDbEnabled(),
      source: previewDrive ? "descritores" : null,
      preview: previewDrive,
    });
  } catch (err) {
    console.error("[indexacao/rostos] Falha ao ler rostos indexados:", err);
    return NextResponse.json({ error: "Falha ao ler indice facial" }, { status: 500 });
  }
}
