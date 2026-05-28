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

  try {
    const todasFotos: { id: string; name: string }[] = [];
    let pageToken: string | undefined;

    // Pagina até buscar todas as fotos (Drive retorna máx 1000 por página)
    do {
      const params = new URLSearchParams({
        // Exclui _banner_* (banner do hero, nao faz parte da galeria)
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false and not name contains '_banner_'`,
        fields: "nextPageToken, files(id,name)",
        pageSize: "1000",
        // Por nome (IMG_0001 → IMG_9999), ordem natural de captura da câmera
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
      todasFotos.push(...(data.files ?? []));
      pageToken = data.nextPageToken;

    } while (pageToken);

    return NextResponse.json({ fotos: todasFotos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
