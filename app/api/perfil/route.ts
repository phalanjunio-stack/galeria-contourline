import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { registrarAtividade } from "@/lib/atividade";
import fs from "fs";
import path from "path";

const ROOT_FOLDER   = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH   = path.join(process.cwd(), "data", "perfis.json");

export interface PerfilUsuario {
  email: string;
  nome: string;
  foto: string;              // foto Google (URL)
  foto_perfil?: string;      // foto de perfil customizada (base64)
  foto_rastreio?: string;    // thumb da foto usada para rastreio (base64 pequena)
  descriptor?: number[];     // legado — 1 vetor facial 128-D
  descriptors?: number[][];  // NOVO — múltiplas selfies (até 3) pra melhorar recall
  foto_rastreios?: string[]; // NOVO — thumbs de cada selfie cadastrada
  notificar_site: boolean;
  criado_em: string;
  atualizado_em: string;
}

/** Normaliza descriptors: array novo OU array com legado convertido. */
function normalizarDescriptors(p?: PerfilUsuario): number[][] {
  if (!p) return [];
  if (Array.isArray(p.descriptors) && p.descriptors.length > 0) return p.descriptors;
  if (Array.isArray(p.descriptor) && p.descriptor.length === 128) return [p.descriptor];
  return [];
}

/* ── Leitura: filesystem local → fallback Drive ─────────────── */
async function lerPerfis(token?: string | null): Promise<PerfilUsuario[]> {
  // 1. Tenta filesystem local (sempre funciona em dev e produção Node)
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch { /* continua */ }

  // 2. Fallback: Google Drive
  if (token && ROOT_FOLDER) {
    try {
      const data = await lerArquivoOculto<PerfilUsuario[]>(ROOT_FOLDER, "_perfis.json", token);
      if (Array.isArray(data) && data.length > 0) {
        // Migra para filesystem local
        salvarLocal(data);
        return data;
      }
    } catch { /* continua */ }
  }

  return [];
}

/* ── Escrita: filesystem local + Drive em paralelo ──────────── */
async function salvarPerfis(perfis: PerfilUsuario[], token?: string | null) {
  // 1. Salva no filesystem local (sempre)
  salvarLocal(perfis);

  // 2. Tenta salvar no Drive em paralelo (sem bloquear)
  if (token && ROOT_FOLDER) {
    salvarArquivoOculto(ROOT_FOLDER, "_perfis.json", perfis, token).catch(() => {});
  }
}

function salvarLocal(perfis: PerfilUsuario[]) {
  try {
    const dir = path.dirname(PERFIS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERFIS_PATH, JSON.stringify(perfis, null, 2), "utf-8");
  } catch { /* ignora erro de FS */ }
}

/* ── Identidade ─────────────────────────────────────────────── */
async function resolverIdentidade(
  session: Awaited<ReturnType<typeof auth>>,
  body?: Record<string, unknown>
) {
  // Usuário Google OAuth
  if (session?.user?.email) {
    const token = (session.accessToken as string | undefined)
      ?? await getAccessTokenFromEnv()
      ?? null;
    return { email: session.user.email, nome: session.user.name ?? "", foto: session.user.image ?? "", token };
  }

  // Usuário simples (email no body ou query)
  const emailSimples = body?.email_simples as string | undefined;
  if (emailSimples?.includes("@")) {
    const token = await getAccessTokenFromEnv();
    // Permite salvar mesmo sem token Drive — filesystem local funciona
    return { email: emailSimples, nome: (body?.nome_simples as string) ?? "", foto: "", token };
  }

  return null;
}

/* ── GET /api/perfil ─────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await auth();
  const emailQuery = req.nextUrl.searchParams.get("email");
  const bodyFake   = emailQuery ? { email_simples: emailQuery } : undefined;
  const ident = await resolverIdentidade(session, bodyFake);
  if (!ident) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const perfis = await lerPerfis(ident.token);
  const perfil = perfis.find(p => p.email === ident.email) ?? null;
  return NextResponse.json(perfil);
}

/* ── POST /api/perfil ────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const session = await auth();
  const body    = await req.json();

  const ident = await resolverIdentidade(session, body);
  if (!ident) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const perfis = await lerPerfis(ident.token);
  const idx    = perfis.findIndex(p => p.email === ident.email);

  const agora = new Date().toISOString();
  const anterior = idx >= 0 ? perfis[idx] : undefined;
  const descsAnteriores = normalizarDescriptors(anterior);

  // Lógica de descriptors:
  // - body.descriptors_add: adiciona à lista existente (append, sem substituir)
  // - body.descriptors:     substitui completo
  // - body.descriptor:      legado, vira array de 1
  // - body.descriptor:null: remove tudo (Remover meu rosto)
  let descriptorsFinal: number[][] | undefined = descsAnteriores.length > 0 ? descsAnteriores : undefined;

  if (body.descriptor === null) {
    descriptorsFinal = undefined; // remoção explícita
  } else if (Array.isArray(body.descriptors)) {
    descriptorsFinal = (body.descriptors as number[][]).filter(d => Array.isArray(d) && d.length === 128).slice(0, 5);
  } else if (Array.isArray(body.descriptors_add)) {
    const novos = (body.descriptors_add as number[][]).filter(d => Array.isArray(d) && d.length === 128);
    descriptorsFinal = [...descsAnteriores, ...novos].slice(0, 5);
  } else if (Array.isArray(body.descriptor) && body.descriptor.length === 128) {
    descriptorsFinal = [body.descriptor];
  }

  // foto_rastreios: append similar
  let rastreiosFinal: string[] | undefined = anterior?.foto_rastreios;
  if (typeof body.foto_rastreio === "string") {
    if (Array.isArray(body.descriptors_add)) {
      // veio junto com novo descriptor → append na lista
      rastreiosFinal = [...(rastreiosFinal ?? (anterior?.foto_rastreio ? [anterior.foto_rastreio] : [])), body.foto_rastreio].slice(0, 5);
    } else {
      // substituição (single legado)
      rastreiosFinal = [body.foto_rastreio];
    }
  }
  if (body.descriptor === null) rastreiosFinal = undefined;

  const novo: PerfilUsuario = {
    email:         ident.email,
    nome:          ident.nome  || anterior?.nome  || "",
    foto:          ident.foto  || anterior?.foto  || "",
    foto_perfil:   body.foto_perfil   ?? anterior?.foto_perfil   ?? undefined,
    foto_rastreio: body.foto_rastreio ?? anterior?.foto_rastreio ?? undefined,
    foto_rastreios: rastreiosFinal,
    descriptor:    descriptorsFinal?.[0] ?? undefined,
    descriptors:   descriptorsFinal,
    notificar_site: body.notificar_site ?? anterior?.notificar_site ?? true,
    criado_em:      anterior?.criado_em ?? agora,
    atualizado_em:  agora,
  };

  if (idx >= 0) perfis[idx] = novo; else perfis.push(novo);
  await salvarPerfis(perfis, ident.token);
  if (idx === -1 || (!anterior?.descriptor && !anterior?.descriptors?.length && (novo.descriptor || novo.descriptors?.length))) {
    await registrarAtividade({
      tipo: "perfil.cadastrado",
      email: novo.email,
      nome: novo.nome,
      detalhes: { referencias: novo.descriptors?.length ?? (novo.descriptor ? 1 : 0) },
    });
  }
  return NextResponse.json(novo);
}
