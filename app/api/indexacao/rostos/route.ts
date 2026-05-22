import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import { lerDescritoresLocal } from "@/lib/storage-local";
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

async function lerPreviewDescritores(eventoId: string): Promise<FaceIndexPreview | null> {
  const fileName = `_desc_${eventoId}.json`;
  const token = await getAccessTokenFromEnv();
  let dados: FotoDescritores[] | null = null;

  if (token && ROOT) {
    try {
      dados = await lerArquivoOculto<FotoDescritores[]>(ROOT, fileName, token);
    } catch { /* usa cache local */ }
  }
  if (!dados) {
    dados = await lerDescritoresLocal<FotoDescritores[]>(eventoId, fileName);
  }
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
    totalFotos: dados.length,
    fotosComRosto: dados.filter((foto) => (foto.rostos?.length ?? 0) > 0).length,
    rostosDetectados: dados.reduce((total, foto) => total + (foto.rostos?.length ?? 0), 0),
    indexedAt: new Date().toISOString(),
    fotos,
  };
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
    const previewDb = faceIndexDbEnabled()
      ? await lerAmostraRostosIndexadosDb(eventoId)
      : null;
    if (previewDb) {
      return NextResponse.json({ enabled: true, source: "pgvector", preview: previewDb });
    }

    const previewDrive = await lerPreviewDescritores(eventoId);
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
