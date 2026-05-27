import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";

// Cache em memória do servidor (sobrevive entre requests, reseta no restart)
const cache = new Map<string, { data: ArrayBuffer; type: string; ts: number }>();
const TTL          = 1000 * 60 * 60;      // 1 hora  — thumbnails
const TTL_ORIGINAL = 1000 * 60 * 60 * 24; // 24 horas — arquivos originais

// GET /api/thumb?id=FILE_ID&sz=400
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const sz = req.nextUrl.searchParams.get("sz") ?? "400";
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const cacheKey = `${id}_${sz}`;
  const ttlAtivo = sz === "original" ? TTL_ORIGINAL : TTL;

  // Serve do cache se ainda válido
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttlAtivo) {
    return new NextResponse(cached.data, {
      headers: {
        "Content-Type": cached.type,
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "HIT",
      },
    });
  }

  const session = await auth();
  // Service account primeiro — sempre fresco; OAuth expira em 1 hora
  const accessToken = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!accessToken) return new NextResponse("Sem token de acesso", { status: 401 });

  try {
    let data: ArrayBuffer | null = null;
    let type = "image/jpeg";

    if (sz !== "original") {
      // Tenta primeiro o thumbnail server da Google (rápido, mas exige thumb pre-gerada)
      const thumbRes = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w${sz}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (thumbRes.ok) {
        const ct = thumbRes.headers.get("content-type") ?? "";
        // Drive ocasionalmente retorna 200 + text/html (pagina de erro). So aceita imagem real.
        if (ct.startsWith("image/")) {
          data = await thumbRes.arrayBuffer();
          type = ct || "image/jpeg";
        }
      }
    }

    // Fallback: arquivo completo via Files API — sempre funciona (uso de banda maior).
    // Tambem usado p/ sz=original.
    if (!data) {
      const fullRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!fullRes.ok) return new NextResponse("Erro ao buscar imagem", { status: fullRes.status });
      data = await fullRes.arrayBuffer();
      type = fullRes.headers.get("content-type") ?? "image/jpeg";
    }

    // Salva no cache
    cache.set(cacheKey, { data, type, ts: Date.now() });

    const maxAge = sz === "original" ? 86400 : 3600;
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": `public, max-age=${maxAge}`,
        "X-Cache": "MISS",
      },
    });
  } catch {
    return new NextResponse("Erro interno", { status: 500 });
  }
}
