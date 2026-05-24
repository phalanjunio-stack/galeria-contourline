import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import type { EventoItem } from "@/app/api/eventos/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;
const FILE_NAME   = "_comentarios.json";

export type StatusComentario = "pendente" | "aprovado" | "rejeitado";

export interface Comentario {
  id:           string;
  eventoId:     string;
  autor_nome:   string;
  autor_email:  string;
  mensagem:     string;
  criado_em:    string;
  status:       StatusComentario;
  likes:        string[]; // emails que curtiram
}

/** Busca pasta_id do evento via /api/eventos (Drive ou cache). */
async function pegarFolderEvento(eventoId: string, token: string): Promise<string | null> {
  try {
    const eventos = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!eventos) return null;
    const ev = eventos.find(e => e.id === eventoId);
    return ev?.folder_id ?? null;
  } catch { return null; }
}

async function lerComentarios(folderId: string, token: string): Promise<Comentario[]> {
  const raw = await lerArquivoOculto<Comentario[]>(folderId, FILE_NAME, token);
  return Array.isArray(raw) ? raw : [];
}

async function salvarComentarios(folderId: string, dados: Comentario[], token: string) {
  await salvarArquivoOculto(folderId, FILE_NAME, dados, token);
}

/* ─────────────────────────────── GET ─────────────────────────────── */
// GET /api/comentarios?eventoId=X[&status=todos]
// Público: só aprovados. Admin pode pedir status=todos.
export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  const querTodos = req.nextUrl.searchParams.get("status") === "todos";
  const session = await auth();
  const isAdmin = !!session?.user?.isAdmin;

  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ error: "sem token" }, { status: 500 });

  const folderEv = await pegarFolderEvento(eventoId, token);
  if (!folderEv) return NextResponse.json({ error: "evento sem pasta" }, { status: 404 });

  const todos = await lerComentarios(folderEv, token);
  const lista = (querTodos && isAdmin)
    ? todos
    : todos.filter(c => c.status === "aprovado");

  // Mais novos primeiro
  lista.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  return NextResponse.json(lista, {
    headers: { "Cache-Control": "no-store" },
  });
}

/* ─────────────────────────────── POST ──────────────────────────────── */
// POST /api/comentarios → cria comentário (status=pendente)
// Body: { eventoId, autor_nome, autor_email, mensagem }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventoId, autor_nome, autor_email, mensagem } = body ?? {};
    if (!eventoId || !autor_nome || !autor_email || !mensagem) {
      return NextResponse.json({ error: "campos obrigatórios faltando" }, { status: 400 });
    }
    if (typeof mensagem !== "string" || mensagem.length > 2000) {
      return NextResponse.json({ error: "mensagem inválida ou muito longa" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(autor_email)) {
      return NextResponse.json({ error: "email inválido" }, { status: 400 });
    }

    const session = await auth();
    const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
    if (!token) return NextResponse.json({ error: "sem token" }, { status: 500 });

    const folderEv = await pegarFolderEvento(eventoId, token);
    if (!folderEv) return NextResponse.json({ error: "evento sem pasta" }, { status: 404 });

    const todos = await lerComentarios(folderEv, token);
    const novo: Comentario = {
      id:          `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventoId,
      autor_nome:  String(autor_nome).trim().slice(0, 80),
      autor_email: String(autor_email).trim().toLowerCase().slice(0, 150),
      mensagem:    String(mensagem).trim(),
      criado_em:   new Date().toISOString(),
      status:      "pendente",
      likes:       [],
    };
    todos.push(novo);
    await salvarComentarios(folderEv, todos, token);

    return NextResponse.json({ ok: true, comentario: novo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ─────────────────────────────── PATCH ─────────────────────────────── */
// PATCH /api/comentarios?id=X
// Body:
//   { status: "aprovado"|"rejeitado" } — só admin
//   { toggleLike: true, email }       — qualquer um (alterna curtir)
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const eventoId = body.eventoId ?? req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) return NextResponse.json({ error: "eventoId obrigatório" }, { status: 400 });

  const session = await auth();
  const isAdmin = !!session?.user?.isAdmin;
  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ error: "sem token" }, { status: 500 });

  const folderEv = await pegarFolderEvento(eventoId, token);
  if (!folderEv) return NextResponse.json({ error: "evento sem pasta" }, { status: 404 });

  const todos = await lerComentarios(folderEv, token);
  const idx = todos.findIndex(c => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "comentário não encontrado" }, { status: 404 });

  if (body.toggleLike) {
    const email = String(body.email ?? "").toLowerCase().trim();
    if (!email) return NextResponse.json({ error: "email obrigatório para curtir" }, { status: 400 });
    const likes = new Set(todos[idx].likes ?? []);
    if (likes.has(email)) likes.delete(email);
    else                  likes.add(email);
    todos[idx].likes = Array.from(likes);
  } else if (body.status) {
    if (!isAdmin) return NextResponse.json({ error: "só admin pode moderar" }, { status: 403 });
    if (!["pendente", "aprovado", "rejeitado"].includes(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    todos[idx].status = body.status as StatusComentario;
  } else {
    return NextResponse.json({ error: "nada pra atualizar" }, { status: 400 });
  }

  await salvarComentarios(folderEv, todos, token);
  return NextResponse.json({ ok: true, comentario: todos[idx] });
}

/* ─────────────────────────────── DELETE ────────────────────────────── */
// DELETE /api/comentarios?id=X&eventoId=Y  (só admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "só admin pode deletar" }, { status: 403 });
  }
  const id       = req.nextUrl.searchParams.get("id");
  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!id || !eventoId) return NextResponse.json({ error: "id e eventoId obrigatórios" }, { status: 400 });

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "sem token" }, { status: 500 });

  const folderEv = await pegarFolderEvento(eventoId, token);
  if (!folderEv) return NextResponse.json({ error: "evento sem pasta" }, { status: 404 });

  const todos = await lerComentarios(folderEv, token);
  const novo = todos.filter(c => c.id !== id);
  if (novo.length === todos.length) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await salvarComentarios(folderEv, novo, token);
  return NextResponse.json({ ok: true });
}
