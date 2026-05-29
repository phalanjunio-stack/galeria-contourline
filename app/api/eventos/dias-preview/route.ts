import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import type { EventoItem } from "@/app/api/eventos/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const DRIVE_API = "https://www.googleapis.com/drive/v3";

type FotoRaw = {
  id: string;
  name: string;
  createdTime?: string;
  imageMediaMetadata?: { time?: string };
};

function extrairData(f: FotoRaw): { data: string | null; fonte: "exif" | "createdTime" | "nenhuma" } {
  const exif = f.imageMediaMetadata?.time;
  if (exif) {
    const m = exif.match(/^(\d{4}):(\d{2}):(\d{2})/);
    if (m) return { data: `${m[1]}-${m[2]}-${m[3]}`, fonte: "exif" };
  }
  if (f.createdTime) return { data: f.createdTime.slice(0, 10), fonte: "createdTime" };
  return { data: null, fonte: "nenhuma" };
}

/**
 * GET /api/eventos/dias-preview?id=X  (admin)
 * Diagnostico: le todas as fotos da pasta principal do evento e mostra
 * como elas se agrupam por data — pra o admin entender por que o
 * auto-dia esta (ou nao esta) separando.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  try {
    // Acha o evento pra pegar a pasta principal e o periodo
    const index = await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token);
    const ev = Array.isArray(index) ? index.find(e => e.id === id) : null;
    if (!ev) return NextResponse.json({ error: "Evento nao encontrado" }, { status: 404 });
    if (!ev.folder_id) {
      return NextResponse.json({ error: "Evento sem pasta principal (folder_id)", semPasta: true }, { status: 200 });
    }

    const inicio = ev.data?.slice(0, 10);
    const fim = (ev.data_fim ?? ev.data)?.slice(0, 10);

    // Lista todas as fotos da pasta principal
    const todas: FotoRaw[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${ev.folder_id}' in parents and mimeType contains 'image/' and trashed = false and not name contains '_banner_'`,
        fields: "nextPageToken, files(id,name,createdTime,imageMediaMetadata(time))",
        pageSize: "1000",
        orderBy: "name",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`${DRIVE_API}/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) break;
      const data = await res.json();
      todas.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Agrupa
    const buckets = new Map<string, number>();
    let semData = 0;
    let foraPeriodo = 0;
    let porExif = 0;
    let porCreatedTime = 0;

    for (const f of todas) {
      const { data, fonte } = extrairData(f);
      if (!data) { semData++; continue; }
      if (fonte === "exif") porExif++;
      else if (fonte === "createdTime") porCreatedTime++;

      if ((inicio && data < inicio) || (fim && data > fim)) { foraPeriodo++; continue; }

      buckets.set(data, (buckets.get(data) ?? 0) + 1);
    }

    const dias = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, total], i) => ({ ordem: i + 1, data, total }));

    return NextResponse.json({
      totalFotos: todas.length,
      diasDetectados: dias.length,
      dias,
      semData,
      foraPeriodo,
      porExif,
      porCreatedTime,
      periodo: { inicio, fim },
      folderId: ev.folder_id,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
