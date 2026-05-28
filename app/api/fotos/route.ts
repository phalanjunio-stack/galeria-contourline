import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";

// Sempre dinâmico — admin pode adicionar fotos no Drive a qualquer momento
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// GET /api/fotos?folderId=xxx  → lista TODAS as fotos da pasta (com paginação)
export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) return NextResponse.json({ error: "folderId obrigatório" }, { status: 400 });

  const session = await auth();
  // Service account primeiro — sempre fresco; OAuth expira em 1 hora
  const accessToken = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!accessToken) return NextResponse.json({ error: "Sem token de acesso" }, { status: 401 });

  type FotoRaw = {
    id: string;
    name: string;
    createdTime?: string;
    imageMediaMetadata?: { time?: string };
  };

  /** Extrai data YYYY-MM-DD priorizando EXIF (imageMediaMetadata.time) e
   *  caindo pra createdTime do Drive como fallback. */
  function extrairData(f: FotoRaw): string | null {
    const exif = f.imageMediaMetadata?.time;
    if (exif) {
      // Formato EXIF típico: "2026:05:26 14:32:01" → ISO local
      const m = exif.match(/^(\d{4}):(\d{2}):(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    if (f.createdTime) {
      // ISO 8601 — pega só a data (UTC). Suficiente p/ bucket por dia.
      return f.createdTime.slice(0, 10);
    }
    return null;
  }

  try {
    const todasFotos: { id: string; name: string; data: string | null }[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false and not name contains '_banner_'`,
        fields: "nextPageToken, files(id,name,createdTime,imageMediaMetadata(time))",
        pageSize: "1000",
        orderBy: "name",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(`${DRIVE_API}/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.error?.message ?? "Erro no Drive" }, { status: res.status });
      }

      const data = await res.json();
      const files: FotoRaw[] = data.files ?? [];
      todasFotos.push(...files.map(f => ({
        id: f.id,
        name: f.name,
        data: extrairData(f),
      })));
      pageToken = data.nextPageToken;

    } while (pageToken);

    return NextResponse.json({ fotos: todasFotos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
