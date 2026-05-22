import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { salvarEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;
const MAX_BACKUPS = 7; // rotativo: últimos 7 dias

// POST /api/cron/backup-eventos
// Cria snapshot diário do _index.json no Drive (rotativo).
// Chame externamente: curl -X POST -H "Authorization: Bearer $CRON_SECRET" ...
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAccessTokenFromEnv();
  if (!token) {
    return NextResponse.json({ error: "Token Drive indisponível" }, { status: 503 });
  }

  try {
    // Lê eventos atuais
    const eventos = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!Array.isArray(eventos)) {
      return NextResponse.json({ error: "_index.json inválido ou vazio" }, { status: 500 });
    }

    // Atualiza cache local também (mantém em sync)
    salvarEventosLocal(eventos);

    // Salva snapshot com timestamp do dia (sobrescreve se rodou no mesmo dia)
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const nomeBackup = `_index.backup.${hoje}.json`;
    await salvarArquivoOculto(ROOT_FOLDER, nomeBackup, eventos, token);

    // Lista backups e remove os mais antigos (mantém últimos MAX_BACKUPS)
    let removidos = 0;
    try {
      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${ROOT_FOLDER}' in parents and name contains '_index.backup.' and trashed=false`)}&fields=files(id,name)&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (listRes.ok) {
        const list = await listRes.json();
        const arquivos: { id: string; name: string }[] = list.files ?? [];
        // Ordena por nome (que contém data) — mais antigos primeiro
        const ordenados = arquivos.sort((a, b) => a.name.localeCompare(b.name));
        const aRemover = ordenados.slice(0, Math.max(0, ordenados.length - MAX_BACKUPS));
        for (const f of aRemover) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          removidos++;
        }
      }
    } catch { /* não bloqueia */ }

    return NextResponse.json({
      ok: true,
      backup: nomeBackup,
      totalEventos: eventos.length,
      backupsAntigosRemovidos: removidos,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Permite GET com query ?secret= também (pra cron simples sem header)
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Encaminha pro POST
  const headers = new Headers(req.headers);
  headers.set("authorization", `Bearer ${cronSecret}`);
  return POST(new NextRequest(req.url, { method: "POST", headers }));
}
