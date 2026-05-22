import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";

// GET /api/admin/drive-folder?id=<folderId>
// Valida se a pasta existe no Drive e retorna nome + contagem de imagens
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const folderId = req.nextUrl.searchParams.get("id");
  if (!folderId) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const token = session.accessToken ?? await getAccessTokenFromEnv();
  if (!token) return NextResponse.json({ error: "Token do Drive indisponível" }, { status: 503 });

  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      return NextResponse.json(
        { ok: false, error: metaRes.status === 404 ? "Pasta não encontrada ou sem permissão" : `HTTP ${metaRes.status}` },
        { status: 200 }
      );
    }
    const meta = await metaRes.json();
    if (meta.mimeType !== "application/vnd.google-apps.folder") {
      return NextResponse.json({ ok: false, error: "O ID informado não é uma pasta" }, { status: 200 });
    }

    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`)}&pageSize=1000&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = listRes.ok ? await listRes.json() : { files: [] };
    const total = Array.isArray(listData.files) ? listData.files.length : 0;

    return NextResponse.json({ ok: true, id: meta.id, name: meta.name, totalImagens: total });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}
