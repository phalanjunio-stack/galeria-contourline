import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { salvarEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;

async function contarImagens(folderId: string, token: string): Promise<number> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`)}&pageSize=1000&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data.files) ? data.files.length : 0;
  } catch {
    return 0;
  }
}

// POST /api/cron/sync-fotos
// Recalcula total_fotos de cada evento e dia (lê o Drive)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAccessTokenFromEnv();
  if (!token) return NextResponse.json({ error: "Token Drive indisponível" }, { status: 503 });

  try {
    const eventos = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!Array.isArray(eventos)) return NextResponse.json({ error: "_index.json inválido" }, { status: 500 });

    let atualizados = 0;
    const novos = await Promise.all(eventos.map(async (e) => {
      let mudou = false;
      let totalEvento = e.total_fotos ?? 0;

      // Atualiza total_fotos do evento (se tem folder_id principal)
      if (e.folder_id) {
        const novo = await contarImagens(e.folder_id, token);
        if (novo !== totalEvento) {
          totalEvento = novo;
          mudou = true;
        }
      }

      // Atualiza total_fotos de cada dia
      let dias = e.dias;
      if (Array.isArray(dias) && dias.length > 0) {
        dias = await Promise.all(dias.map(async (d) => {
          if (!d.folder_id) return d;
          const total = await contarImagens(d.folder_id, token);
          if (total !== (d.total_fotos ?? 0)) {
            mudou = true;
            return { ...d, total_fotos: total };
          }
          return d;
        }));
        // Se evento sem folder_id próprio, soma totais dos dias
        if (!e.folder_id) {
          const soma = dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0);
          if (soma !== totalEvento) {
            totalEvento = soma;
            mudou = true;
          }
        }
      }

      if (mudou) atualizados++;
      return { ...e, total_fotos: totalEvento, dias };
    }));

    if (atualizados > 0) {
      await salvarArquivoOculto(ROOT_FOLDER, "_index.json", novos, token);
      salvarEventosLocal(novos);
    }

    return NextResponse.json({
      ok: true,
      atualizados,
      total: eventos.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = new Headers(req.headers);
  headers.set("authorization", `Bearer ${cronSecret}`);
  return POST(new NextRequest(req.url, { method: "POST", headers }));
}
