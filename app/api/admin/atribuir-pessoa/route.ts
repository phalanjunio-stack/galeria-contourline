import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { registrarAtividade } from "@/lib/atividade";
import type { PerfilUsuario } from "@/app/api/perfil/route";
import type { MeusFotosData, MeusFotosEvento } from "@/app/api/meu/fotos/route";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

interface Body {
  email: string;
  nome: string;
  descritor_medio: number[];   // 128-D do cluster
  eventoId: string;
  eventoNome: string;
  fotoIds: string[];           // fotos do cluster
}

function lerPerfisLocais(): PerfilUsuario[] {
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch { /* */ }
  return [];
}

function salvarPerfisLocais(perfis: PerfilUsuario[]) {
  try {
    const dir = path.dirname(PERFIS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERFIS_PATH, JSON.stringify(perfis, null, 2), "utf-8");
  } catch { /* */ }
}

/**
 * POST /api/admin/atribuir-pessoa
 *
 * Admin identifica uma pessoa detectada (cluster) e associa a um email.
 * Faz duas coisas:
 *   1. Adiciona o descritor_medio do cluster aos descritores do perfil do usuario
 *      (até 5, append) — assim a IA reconhece essa pessoa em eventos futuros.
 *   2. Adiciona as fotos do cluster ao _mf_{email}.json (merge) — o usuario ve
 *      essas fotos no "Minhas fotos" imediatamente.
 *
 * Se o email nao tem perfil, cria um simples (nome + email + descriptor).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }
  const { email, nome, descritor_medio, eventoId, eventoNome, fotoIds } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email obrigatorio" }, { status: 400 });
  }
  if (!Array.isArray(descritor_medio) || descritor_medio.length !== 128) {
    return NextResponse.json({ error: "descritor_medio (128-D) obrigatorio" }, { status: 400 });
  }
  if (!eventoId) {
    return NextResponse.json({ error: "eventoId obrigatorio" }, { status: 400 });
  }

  try {
    // ─── 1. Atualiza perfil (adiciona descriptor) ───────────────────────────
    const perfis = lerPerfisLocais();
    let idx = perfis.findIndex(p => p.email?.toLowerCase() === email.toLowerCase());
    const agora = new Date().toISOString();

    if (idx === -1) {
      // Cria perfil novo
      perfis.push({
        email: email.toLowerCase(),
        nome: nome || email.split("@")[0],
        foto: "",
        descriptor: descritor_medio,
        descriptors: [descritor_medio],
        notificar_site: true,
        criado_em: agora,
        atualizado_em: agora,
      });
      idx = perfis.length - 1;
    } else {
      const p = perfis[idx];
      const descsAnteriores: number[][] = Array.isArray(p.descriptors) && p.descriptors.length > 0
        ? p.descriptors
        : (Array.isArray(p.descriptor) && p.descriptor.length === 128 ? [p.descriptor] : []);

      // Evita duplicar: se ja tem um descriptor muito proximo (< 0.25), nao adiciona
      const jaSemelhante = descsAnteriores.some(d => {
        let s = 0;
        for (let i = 0; i < 128; i++) { const x = d[i] - descritor_medio[i]; s += x * x; }
        return Math.sqrt(s) < 0.25;
      });

      const novos = jaSemelhante ? descsAnteriores : [...descsAnteriores, descritor_medio].slice(0, 5);
      perfis[idx] = {
        ...p,
        nome: p.nome || nome,
        descriptor: novos[0],
        descriptors: novos,
        atualizado_em: agora,
      };
    }

    salvarPerfisLocais(perfis);
    // Mirror pra Drive (best-effort, nao bloqueia)
    salvarArquivoOculto(ROOT, "_perfis.json", perfis, token).catch(() => {});

    // ─── 2. Atualiza _mf_{email}.json (merge fotos) ──────────────────────────
    if (Array.isArray(fotoIds) && fotoIds.length > 0) {
      const key = `_mf_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
      const atual = await lerArquivoOculto<MeusFotosData>(ROOT, key, token).catch(() => null);
      const evAnterior = atual?.eventos?.find(e => e.eventoId === eventoId);
      const outros = atual?.eventos?.filter(e => e.eventoId !== eventoId) ?? [];

      const fotoIdsFinais = evAnterior?.fotoIds?.length
        ? Array.from(new Set([...evAnterior.fotoIds, ...fotoIds]))
        : fotoIds;

      const eventos: MeusFotosEvento[] = [
        ...outros,
        { eventoId, eventoNome: eventoNome || "", fotoIds: fotoIdsFinais, processadoEm: agora },
      ];

      const novo: MeusFotosData = {
        email: email.toLowerCase(),
        eventos,
        totalFotos: eventos.reduce((s, e) => s + e.fotoIds.length, 0),
        atualizadoEm: agora,
      };

      await salvarArquivoOculto(ROOT, key, novo, token);
    }

    // ─── 3. Atividade (audit log) ────────────────────────────────────────────
    await registrarAtividade({
      tipo: "pessoa.identificada",
      email: session.user.email ?? undefined,
      nome: session.user.name ?? undefined,
      detalhes: { evento: eventoNome, eventoId, alvo: email, fotos: fotoIds?.length ?? 0 },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      email,
      nome,
      descritoresNoPerfil: (perfis[idx].descriptors ?? []).length,
      fotosAdicionadas: fotoIds?.length ?? 0,
    });
  } catch (err) {
    console.error("[/api/admin/atribuir-pessoa]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/atribuir-pessoa  (body igual ao POST)
 *
 * Desfaz uma atribuicao errada ("Não é essa pessoa"):
 *   1. Remove as fotos do cluster do _mf_{email}.json daquele evento.
 *   2. Remove do perfil o descritor mais proximo do descritor_medio do
 *      cluster (se distancia < 0.30 — provavelmente foi o que adicionamos).
 *      NUNCA remove se sobraria 0 descritores que vieram de selfie do proprio
 *      usuario? -> removemos so o que casa; selfies legitimas ficam.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const token = (await getAccessTokenFromEnv()) ?? session.accessToken;
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 401 });

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const { email, descritor_medio, eventoId, fotoIds } = body;
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email obrigatorio" }, { status: 400 });
  }

  try {
    // 1. Remove o descritor adicionado (o mais proximo do centroide do cluster)
    if (Array.isArray(descritor_medio) && descritor_medio.length === 128) {
      const perfis = lerPerfisLocais();
      const idx = perfis.findIndex(p => p.email?.toLowerCase() === email.toLowerCase());
      if (idx !== -1) {
        const p = perfis[idx];
        const descs: number[][] = Array.isArray(p.descriptors) && p.descriptors.length > 0
          ? p.descriptors
          : (Array.isArray(p.descriptor) && p.descriptor.length === 128 ? [p.descriptor] : []);
        // Acha o mais proximo do centroide
        let melhorI = -1, melhorD = Infinity;
        descs.forEach((d, i) => {
          let s = 0;
          for (let k = 0; k < 128; k++) { const x = d[k] - descritor_medio[k]; s += x * x; }
          const dist = Math.sqrt(s);
          if (dist < melhorD) { melhorD = dist; melhorI = i; }
        });
        if (melhorI !== -1 && melhorD < 0.30) {
          const novos = descs.filter((_, i) => i !== melhorI);
          perfis[idx] = {
            ...p,
            descriptor: novos[0],
            descriptors: novos.length > 0 ? novos : undefined,
            atualizado_em: new Date().toISOString(),
          };
          salvarPerfisLocais(perfis);
          salvarArquivoOculto(ROOT, "_perfis.json", perfis, token).catch(() => {});
        }
      }
    }

    // 2. Remove as fotos do cluster do _mf_ daquele evento
    if (eventoId && Array.isArray(fotoIds) && fotoIds.length > 0) {
      const key = `_mf_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
      const atual = await lerArquivoOculto<MeusFotosData>(ROOT, key, token).catch(() => null);
      if (atual?.eventos?.length) {
        const remover = new Set(fotoIds);
        const eventos = atual.eventos
          .map(e => e.eventoId === eventoId
            ? { ...e, fotoIds: e.fotoIds.filter(id => !remover.has(id)) }
            : e)
          .filter(e => e.fotoIds.length > 0);
        const novo: MeusFotosData = {
          email: email.toLowerCase(),
          eventos,
          totalFotos: eventos.reduce((s, e) => s + e.fotoIds.length, 0),
          atualizadoEm: new Date().toISOString(),
        };
        await salvarArquivoOculto(ROOT, key, novo, token);
      }
    }

    await registrarAtividade({
      tipo: "pessoa.rejeitada",
      email: session.user.email ?? undefined,
      nome: session.user.name ?? undefined,
      detalhes: { eventoId, alvo: email, fotos: fotoIds?.length ?? 0 },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/atribuir-pessoa DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
