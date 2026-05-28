import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { lerEventosLocal, salvarEventosLocal } from "@/lib/eventos-cache";
import { registrarAtividade } from "@/lib/atividade";
import { agruparPorData, type FotoComData } from "@/lib/auto-dias";

// Sempre dinâmico — não cachear em build/runtime do Next.
// Sem isso, /eventos e / (home) podem ver listas diferentes.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface EventoDia {
  id: string;                  // ex: "dia1" — usado em ?dia=...
  titulo: string;              // "Dia 1 — Abertura"
  data: string;                // ISO date — "2026-05-07"
  descricao?: string;
  folder_id: string;           // pasta separada no Drive
  total_fotos?: number;
  capa_id?: string;
  /** Foco da capa no card: "top left", "top", "center", etc. (CSS object-position). Default: "center" */
  capa_position?: string;
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
  /** Foco da capa no card: "top left", "top", "center", etc. (CSS object-position). Default: "center" */
  capa_position?: string;
  /** Banner dedicado pro hero "Evento em andamento" — separado da capa da galeria.
   *  ID de arquivo no Drive (uploadado pelo admin como _banner_{id}.{ext}). */
  banner_id?: string;
  /** Foco do banner no hero (CSS object-position). Default: "center right" */
  banner_position?: string;
  /** Dias internos — se vazio/undefined, evento é tratado como 1 dia (usa folder_id). */
  dias?: EventoDia[];
  /** Quando true, ignora 'dias' configurados manualmente e gera dias automaticamente
   *  agrupando as fotos da folder_id principal por EXIF/createdTime. */
  auto_dias_por_data?: boolean;
  criado_em: string;
  /** Quantas pessoas distintas a IA achou — derivado de _matches_{id}.json em runtime. */
  pessoas_encontradas?: number;
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
  const serviceToken = await getAccessTokenFromEnv();
  const tokens = [...new Set([sessionToken, serviceToken].filter(Boolean))] as string[];

  for (const token of tokens) {
    try {
      await salvarArquivoOculto(ROOT_FOLDER, "_index.json", eventos, token);
      return true;
    } catch { /**/ }
  }
  return false;
}

/* Cache em memória da contagem de pessoas por evento — TTL 60s.
   Evita ler N arquivos do Drive em todo GET /api/eventos. */
type PessoasCache = { ts: number; pessoas: number };
const pessoasCache = new Map<string, PessoasCache>();
const PESSOAS_TTL_MS = 60_000;

/* Cache dos dias auto-detectados (uma chamada ao Drive lista todos os arquivos) — TTL 5min. */
type DiasAutoCache = { ts: number; dias: EventoDia[] };
const diasAutoCache = new Map<string, DiasAutoCache>();
const DIAS_AUTO_TTL_MS = 5 * 60_000;

const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function listarFotosComData(folderId: string, token: string): Promise<FotoComData[]> {
  const todasFotos: FotoComData[] = [];
  let pageToken: string | undefined;
  type FotoRaw = {
    id: string;
    name: string;
    createdTime?: string;
    imageMediaMetadata?: { time?: string };
  };
  function extrairData(f: FotoRaw): string | null {
    const exif = f.imageMediaMetadata?.time;
    if (exif) {
      const m = exif.match(/^(\d{4}):(\d{2}):(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return f.createdTime ? f.createdTime.slice(0, 10) : null;
  }
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false and not name contains '_banner_'`,
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
    const files: FotoRaw[] = data.files ?? [];
    todasFotos.push(...files.map(f => ({ id: f.id, name: f.name, data: extrairData(f) })));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return todasFotos;
}

async function diasAutoDoEvento(ev: EventoItem, token: string): Promise<EventoDia[]> {
  if (!ev.folder_id) return [];
  const cached = diasAutoCache.get(ev.id);
  if (cached && Date.now() - cached.ts < DIAS_AUTO_TTL_MS) return cached.dias;
  try {
    const fotos = await listarFotosComData(ev.folder_id, token);
    const dias = agruparPorData(ev.folder_id, fotos, {
      inicio: ev.data?.slice(0, 10),
      fim: (ev.data_fim ?? ev.data)?.slice(0, 10),
    });
    // Não enviamos as fotos inline aqui — só os dias com counts/capas
    const enxutos: EventoDia[] = dias.map(d => ({
      id: d.id,
      titulo: d.titulo,
      data: d.data,
      folder_id: d.folder_id,
      total_fotos: d.total_fotos,
      capa_id: d.capa_id,
      status: d.status,
    }));
    diasAutoCache.set(ev.id, { ts: Date.now(), dias: enxutos });
    return enxutos;
  } catch {
    return cached?.dias ?? [];
  }
}

async function contarPessoas(eventoId: string, folderId: string, token: string): Promise<number> {
  const cached = pessoasCache.get(eventoId);
  if (cached && Date.now() - cached.ts < PESSOAS_TTL_MS) return cached.pessoas;
  try {
    // PRIORIDADE 1: _pessoas_{id}.json → clusters de TODAS as pessoas únicas detectadas
    // (independente de ter perfil cadastrado). Esse é o número "real" no evento.
    const pessoas = await lerArquivoOculto<{ clusters?: unknown[] }>(
      folderId, `_pessoas_${eventoId}.json`, token
    );
    let n = Array.isArray(pessoas?.clusters) ? pessoas!.clusters!.length : 0;

    // FALLBACK: se ainda não tem clusters mas tem matches, usa contagem de matches
    if (n === 0) {
      const matches = await lerArquivoOculto<{ usuarios?: { email: string }[] }>(
        folderId, `_matches_${eventoId}.json`, token
      ).catch(() => null);
      n = Array.isArray(matches?.usuarios) ? matches!.usuarios!.length : 0;
    }

    pessoasCache.set(eventoId, { ts: Date.now(), pessoas: n });
    return n;
  } catch {
    return cached?.pessoas ?? 0;
  }
}

// GET /api/eventos — público, sem necessidade de login
export async function GET() {
  const session = await auth();
  // Usa token da sessão se disponível, senão usa token do .env ou cache local
  const eventos = await lerEventos(session?.accessToken);

  // Enriquece com contagem real de pessoas (paralelo + cache 60s)
  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (token) {
    await Promise.all(eventos.map(async (ev) => {
      if (!ev.folder_id) return;
      ev.pessoas_encontradas = await contarPessoas(ev.id, ev.folder_id, token);
      // Auto-detecta dias por data (EXIF/createdTime) quando o evento tem o flag ligado
      // e nao tem dias configurados manualmente.
      if (ev.auto_dias_por_data && (!ev.dias || ev.dias.length === 0)) {
        const dias = await diasAutoDoEvento(ev, token);
        if (dias.length > 0) ev.dias = dias;
      }
    }));
  }

  return NextResponse.json(eventos, {
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "Pragma": "no-cache",
    },
  });
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
      data_fim:              body.data_fim,
      local:                 body.local,
      categoria:             body.categoria ?? "Evento",
      tags:                  Array.isArray(body.tags) ? body.tags : [],
      descricao:             body.descricao ?? "",
      status:                body.status ?? "aberto",
      reconhecimento_facial: body.reconhecimento_facial ?? true,
      download_liberado:     body.download_liberado ?? true,
      acesso:                body.acesso ?? "publico",
      folder_id:             body.folder_id ?? "",
      total_fotos:           0,
      dias:                  Array.isArray(body.dias) ? body.dias : undefined,
      criado_em:             body.criado_em ?? new Date().toISOString(),
    };

    index.unshift(novo);
    const salvo = await salvarEventos(index, session.accessToken);
    if (!salvo) {
      return NextResponse.json({ error: "Nao foi possivel salvar o indice de eventos no Drive." }, { status: 502 });
    }
    await registrarAtividade({
      tipo: "evento.criado",
      email: session.user.email ?? undefined,
      nome: session.user.name ?? undefined,
      detalhes: { evento: novo.nome, eventoId: novo.id },
    });
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
    const anterior = index[idx];
    index[idx] = { ...index[idx], ...body };
    const salvo = await salvarEventos(index, session.accessToken);
    if (!salvo) {
      return NextResponse.json({ error: "Nao foi possivel salvar o indice de eventos no Drive." }, { status: 502 });
    }
    await registrarAtividade({
      tipo: "evento.editado",
      email: session.user.email ?? undefined,
      nome: session.user.name ?? undefined,
      detalhes: { evento: index[idx].nome, eventoId: id, statusAnterior: anterior.status, statusNovo: index[idx].status },
    });
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
    const removido = index.find((e) => e.id === id);
    const novo  = index.filter((e) => e.id !== id);
    const salvo = await salvarEventos(novo, session.accessToken);
    if (!salvo) {
      return NextResponse.json({ error: "Nao foi possivel remover o evento do indice no Drive." }, { status: 502 });
    }
    await registrarAtividade({
      tipo: "evento.removido",
      email: session.user.email ?? undefined,
      nome: session.user.name ?? undefined,
      detalhes: { evento: removido?.nome ?? id, eventoId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
