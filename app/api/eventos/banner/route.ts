import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import type { EventoItem } from "@/app/api/eventos/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;
const DRIVE_API   = "https://www.googleapis.com/drive/v3";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED   = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extDe(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png")  return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif")  return "gif";
  return "jpg";
}

/** Procura banner existente do evento na pasta dele e retorna o id, se houver. */
async function acharBannerExistente(folderId: string, eventoId: string, token: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name contains '_banner_${eventoId}' and trashed = false`,
    fields: "files(id,name)",
  });
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function deletarArquivo(id: string, token: string) {
  await fetch(`${DRIVE_API}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

/** Cria novo arquivo na pasta, retorna o ID do arquivo no Drive. */
async function uploadParaDrive(folderId: string, fileName: string, file: File, token: string): Promise<string> {
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const formData = new FormData();
  formData.append("metadata", new Blob([meta], { type: "application/json" }));
  formData.append("file", file);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Falha no upload do Drive: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.id) throw new Error("Drive nao retornou id do arquivo.");
  return data.id;
}

// POST /api/eventos/banner?id={eventoId}  (multipart: file=<binary>)
//   → faz upload do banner pra pasta do evento no Drive,
//     atualiza event.banner_id e devolve { banner_id }.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const eventoId = req.nextUrl.searchParams.get("id");
  if (!eventoId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "arquivo (file) obrigatório" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem grande demais (max 8MB)" }, { status: 413 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Formato não suportado (use JPG, PNG, WEBP ou GIF)" }, { status: 415 });
    }

    const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
    if (!token) return NextResponse.json({ error: "Sem token do Drive" }, { status: 401 });

    // Lê index, acha evento e descobre pasta-alvo
    const index = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!Array.isArray(index)) {
      return NextResponse.json({ error: "Index de eventos indisponível" }, { status: 502 });
    }
    const idx = index.findIndex(e => e.id === eventoId);
    if (idx === -1) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    const evento = index[idx];
    const targetFolder = evento.folder_id || ROOT_FOLDER;

    // Remove banner anterior (se existir) pra não acumular lixo
    const existente = await acharBannerExistente(targetFolder, eventoId, token);
    if (existente) await deletarArquivo(existente, token);

    // Sobe o novo
    const ext = extDe(file.type);
    const nome = `_banner_${eventoId}.${ext}`;
    const banner_id = await uploadParaDrive(targetFolder, nome, file, token);

    // Atualiza index com o novo banner_id (preserva posição existente)
    index[idx] = { ...evento, banner_id };
    await salvarArquivoOculto(ROOT_FOLDER, "_index.json", index, token);

    return NextResponse.json({ banner_id });
  } catch (err) {
    console.error("[/api/eventos/banner POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/eventos/banner?id={eventoId}  → remove banner do evento
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const eventoId = req.nextUrl.searchParams.get("id");
  if (!eventoId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
    if (!token) return NextResponse.json({ error: "Sem token do Drive" }, { status: 401 });

    const index = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!Array.isArray(index)) {
      return NextResponse.json({ error: "Index indisponível" }, { status: 502 });
    }
    const idx = index.findIndex(e => e.id === eventoId);
    if (idx === -1) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

    const evento = index[idx];
    const targetFolder = evento.folder_id || ROOT_FOLDER;
    const existente = await acharBannerExistente(targetFolder, eventoId, token);
    if (existente) await deletarArquivo(existente, token);

    delete index[idx].banner_id;
    await salvarArquivoOculto(ROOT_FOLDER, "_index.json", index, token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/eventos/banner DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
