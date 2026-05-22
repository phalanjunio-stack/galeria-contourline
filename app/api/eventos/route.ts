import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerEventosLocal, salvarEventosLocal } from "@/lib/eventos-cache";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface EventoDia {
  id: string;                  // ex: "dia1" — usado em ?dia=...
  titulo: string;              // "Dia 1 — Abertura"
  data: string;                // ISO date — "2026-05-07"
  descricao?: string;
  folder_id: string;           // pasta separada no Drive
  total_fotos?: number;
  status?: "disponivel" | "processando" | "fechado";
}

export interface EventoItem {
  id: string;
  nome: string;
  data: string;
  data_fim?: string;           // intervalo (presente em multi-dia)
  local?: string;
  categoria?: string;
  tags?: string[];
  descricao?: string;
  status: string;
  reconhecimento_facial: boolean;
  download_liberado: boolean;
  acesso: string;
  folder_id: string;
  total_fotos: number;
  capa_id?: string;
  /** Dias internos — se vazio/undefined, evento é tratado como 1 dia (usa folder_id). */
  dias?: EventoDia[];
  criado_em: string;
}

// Tenta ler do Drive; se falhar usa cache local
async function lerEventos(sessionToken?: string): Promise<EventoItem[]> {
  const serviceToken = await getAccessTokenFromEnv();
  const tokens = [...new Set([sessionToken, serviceToken].filter(Boolean))] as string[];

  for (const token of tokens) {
    try {
      const fromDrive = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
      if (fromDrive && fromDrive.length > 0) {
        salvarEventosLocal(fromDrive); // atualiza cache local
        return fromDrive;
      }
    } catch { /**/ }
  }
  // Fallback: retorna cache local
  return lerEventosLocal();
}

// Salva no Drive E no cache local
async function salvarEventos(eventos: EventoItem[], sessionToken?: string) {
  salvarEventosLocal(eventos); // salva local primeiro (nunca falha)
  const token = sessionToken ?? await getAccessTokenFromEnv();
  if (token) {
    try {
      await salvarArquivoOculto(ROOT_FOLDER, "_index.json", eventos, token);
    } catch { /**/ }
  }
}

// GET /api/eventos — público, sem necessidade de login
export async function GET() {
  const session = await auth();
  // Usa token da sessão se disponível, senão usa token do .env ou cache local
  const eventos = await lerEventos(session?.accessToken);
  return NextResponse.json(eventos);
}

// POST /api/eventos → cria novo evento
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const body  = await req.json();
    const index = await lerEventos(session.accessToken);

    const novo: EventoItem = {
      id:                    Date.now().toString(),
      nome:                  body.nome,
      data:                  body.data,
      categoria:             body.categoria ?? "Evento",
      tags:                  Array.isArray(body.tags) ? body.tags : [],
      descricao:             body.descricao ?? "",
      status:                body.status ?? "aberto",
      reconhecimento_facial: body.reconhecimento_facial ?? true,
      download_liberado:     body.download_liberado ?? true,
      acesso:                body.acesso ?? "publico",
      folder_id:             body.folder_id ?? "",
      total_fotos:           0,
      criado_em:             body.criado_em ?? new Date().toISOString(),
    };

    index.unshift(novo);
    await salvarEventos(index, session.accessToken);
    return NextResponse.json(novo);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/eventos?id=xxx → atualiza campos
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const body  = await req.json();
    const index = await lerEventos(session.accessToken);
    const idx   = index.findIndex((e) => e.id === id);
    if (idx === -1) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    index[idx] = { ...index[idx], ...body };
    await salvarEventos(index, session.accessToken);
    return NextResponse.json(index[idx]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/eventos?id=xxx → remove
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const index = await lerEventos(session.accessToken);
    const novo  = index.filter((e) => e.id !== id);
    await salvarEventos(novo, session.accessToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
