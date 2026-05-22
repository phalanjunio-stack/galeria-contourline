import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerRostoIndexadoDb } from "@/lib/face-index-db";

const THUMB_SIZE = 640;

function cropArea(
  imageWidth: number,
  imageHeight: number,
  box: { x: number | null; y: number | null; width: number | null; height: number | null }
) {
  if (
    box.x === null ||
    box.y === null ||
    box.width === null ||
    box.height === null ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return null;
  }

  const margin = Math.max(box.width, box.height) * 0.28;
  const left = Math.max(0, Math.floor(box.x - margin));
  const top = Math.max(0, Math.floor(box.y - margin));
  const right = Math.min(imageWidth, Math.ceil(box.x + box.width + margin));
  const bottom = Math.min(imageHeight, Math.ceil(box.y + box.height + margin));
  const width = right - left;
  const height = bottom - top;
  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return new NextResponse("Nao autorizado", { status: 401 });
  }

  const faceId = req.nextUrl.searchParams.get("id");
  const fotoId = req.nextUrl.searchParams.get("fotoId");
  const rosto = faceId
    ? await lerRostoIndexadoDb(faceId)
    : fotoId
    ? {
        fotoId,
        box: {
          x: Number(req.nextUrl.searchParams.get("x")),
          y: Number(req.nextUrl.searchParams.get("y")),
          width: Number(req.nextUrl.searchParams.get("width")),
          height: Number(req.nextUrl.searchParams.get("height")),
        },
      }
    : null;
  if (!rosto) {
    return new NextResponse("Rosto nao encontrado", { status: 404 });
  }
  if (Object.values(rosto.box).some((n) => !Number.isFinite(n))) {
    return new NextResponse("Recorte invalido", { status: 400 });
  }

  const accessToken = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!accessToken) {
    return new NextResponse("Sem token Drive", { status: 401 });
  }

  // O face-server detecta sobre thumbnails Drive com `s640`; use a mesma escala no recorte.
  const driveThumb = `https://drive.google.com/thumbnail?id=${encodeURIComponent(rosto.fotoId)}&sz=s${THUMB_SIZE}`;
  const thumbRes = await fetch(driveThumb, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!thumbRes.ok) {
    return new NextResponse("Falha ao buscar thumbnail", { status: thumbRes.status });
  }

  const image = sharp(Buffer.from(await thumbRes.arrayBuffer()));
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    return new NextResponse("Thumbnail sem dimensoes", { status: 422 });
  }

  const area = cropArea(metadata.width, metadata.height, rosto.box);
  if (!area) {
    return new NextResponse("Rosto sem recorte", { status: 422 });
  }

  const crop = await image
    .extract(area)
    .resize(220, 220, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();

  return new NextResponse(crop, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
