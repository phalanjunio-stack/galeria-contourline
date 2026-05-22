import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto, deletarArquivoOculto } from "@/lib/drive";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

export interface MeusFotosEvento {
  eventoId: string;
  eventoNome: string;
  fotoIds: string[];
  processadoEm: string;
}

export interface MeusFotosData {
  email: string;
  eventos: MeusFotosEvento[];
  totalFotos: number;
  atualizadoEm: string;
}

/**
 * GET /api/meu/fotos?email=xxx
 * Retorna os matches verificados pelo admin para este usuário.
 * Lê _mf_{email}.json do Drive — gravado pelo admin após indexação.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json(null);

  const session = await auth();
  const token   = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json(null);

  try {
    const key  = `_mf_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
    const data = await lerArquivoOculto<MeusFotosData>(ROOT, key, token);
    return NextResponse.json(data ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

/**
 * PUT /api/meu/fotos
 * Grava/atualiza o arquivo de fotos verificadas de um usuário.
 * Body: { email, eventoId, eventoNome, fotoIds[], processadoEm, merge? }
 *
 * Autorização: admin pode gravar pra qualquer email; usuário Google só pra
 * o próprio email da sessão; simples (sem sessão) é confiado — pode gravar
 * pro email que indicar (mesmo modelo do resto do app).
 */
// Lock por email para evitar race condition em multi-cliente
// (duas abas/dispositivos gravando o mesmo _mf_email.json simultaneamente)
const locks = new Map<string, Promise<void>>();

async function comLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (locks.has(key)) {
    try { await locks.get(key); } catch { /**/ }
  }
  let resolver: () => void = () => {};
  const p = new Promise<void>((res) => { resolver = res; });
  locks.set(key, p);
  try {
    return await fn();
  } finally {
    locks.delete(key);
    resolver();
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();

  // Token Drive (server-side, sempre via env/disco)
  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  const body: { email: string; eventoId: string; eventoNome: string; fotoIds: string[]; processadoEm: string; merge?: boolean } = await req.json();
  const { email, eventoId, eventoNome, fotoIds, processadoEm, merge } = body;
  if (!email || !eventoId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  // Usuário Google só pode gravar pro próprio email
  if (session?.user?.email && !session.user.isAdmin) {
    const sessionEmail = session.user.email.toLowerCase().trim();
    if (sessionEmail !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: "Email não corresponde à sessão" }, { status: 403 });
    }
  }

  const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const key = `_mf_${emailKey}.json`;

  try {
    const result = await comLock(emailKey, async () => {
      // Lê dados existentes e atualiza apenas o evento
      const atual = await lerArquivoOculto<MeusFotosData>(ROOT, key, token).catch(() => null);
      const eventosExist: MeusFotosEvento[] = atual?.eventos ?? [];
      const evAnterior = eventosExist.find(e => e.eventoId === eventoId);
      const outros    = eventosExist.filter(e => e.eventoId !== eventoId);

      // Se merge=true, soma fotos novas com as já confirmadas (sem duplicar)
      const fotoIdsFinais = merge && evAnterior?.fotoIds?.length
        ? Array.from(new Set([...evAnterior.fotoIds, ...fotoIds]))
        : fotoIds;

      const eventos: MeusFotosEvento[] = fotoIdsFinais.length
        ? [...outros, { eventoId, eventoNome, fotoIds: fotoIdsFinais, processadoEm }]
        : outros;

      const data: MeusFotosData = {
        email,
        eventos,
        totalFotos: eventos.reduce((s, e) => s + e.fotoIds.length, 0),
        atualizadoEm: new Date().toISOString(),
      };

      await salvarArquivoOculto(ROOT, key, data, token);
      return data;
    });
    return NextResponse.json({ ok: true, totalFotos: result.totalFotos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/meu/fotos?email=xxx
 * Apaga TODAS as fotos confirmadas do usuário (reset completo).
 * Útil quando outra pessoa começa a usar o mesmo email/dispositivo.
 *
 * Autorização: admin OU dono do email (sessão Google) OU simples (sem sessão, trust).
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });

  // Mesma autorização do PUT
  if (session?.user?.email && !session.user.isAdmin) {
    if (session.user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: "Email não corresponde à sessão" }, { status: 403 });
    }
  }

  const token = (await getAccessTokenFromEnv()) ?? session?.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  const key = `_mf_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
  try {
    const removed = await deletarArquivoOculto(ROOT, key, token);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
