import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import fs from "fs";
import path from "path";

/**
 * GET /api/cron/processar
 *
 * Executa o matching server-side contra os índices já salvos:
 *  1. Carrega todos os eventos
 *  2. Para cada evento com _desc_{id}.json, carrega o índice de descritores
 *  3. Compara contra todos os perfis de usuários (distância Euclidiana)
 *  4. Detecta NOVOS matches (usuários que se cadastraram após o processamento manual)
 *  5. Envia notificações e atualiza _matches_{id}.json
 *
 * Protegido por CRON_SECRET (env var). Chamado pelo Vercel Cron ou serviço externo.
 */

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");
const AUTOMACAO_PATH = path.join(process.cwd(), "data", "automacao.json");

// Distância máxima para considerar match — face-api.js 128-dim:
// < 0.40 = alta confiança, 0.40-0.50 = provável, > 0.50 = incerto
const THRESHOLD = 0.42;

// Só processa eventos criados/realizados nos últimos N dias
const MAX_DIAS_EVENTO = 7;

interface PerfilUsuario {
  email: string;
  nome: string;
  descriptor: number[];
  notificar_site?: boolean;
}

interface FotoDescritores {
  fotoId: string;
  rostos: { descriptor: number[] }[];
}

interface MatchUsuarioSalvo {
  email: string;
  nome: string;
  fotosIds: string[];
  thumbUrl?: string;
}

interface ResultadoIndexacao {
  eventoId: string;
  eventoNome: string;
  processadoEm: string;
  totalFotos: number;
  fotosComRosto: number;
  usuarios: MatchUsuarioSalvo[];
}

interface EventoItem {
  id: string;
  nome: string;
  data?: string;
  criado_em?: string;
  folder_id?: string;
  reconhecimento_facial?: boolean;
  status?: string;
}

interface AutomacaoConfig {
  enabled: boolean;
  hora: string;
  eventos: "todos" | string[];
  ultimaExecucao: string | null;
  ultimoLog: string | null;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function lerConfig(): AutomacaoConfig | null {
  try {
    if (fs.existsSync(AUTOMACAO_PATH))
      return JSON.parse(fs.readFileSync(AUTOMACAO_PATH, "utf-8"));
  } catch { /* ignora */ }
  return null;
}

function salvarConfig(patch: Partial<AutomacaoConfig>) {
  try {
    const atual = lerConfig() ?? {};
    fs.writeFileSync(AUTOMACAO_PATH, JSON.stringify({ ...atual, ...patch }, null, 2), "utf-8");
  } catch { /* ignora */ }
}

function lerPerfisLocal(): PerfilUsuario[] {
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const data = JSON.parse(fs.readFileSync(PERFIS_PATH, "utf-8"));
      if (Array.isArray(data)) return data;
    }
  } catch { /* ignora */ }
  return [];
}

export async function GET(req: NextRequest) {
  // Verifica segredo — Vercel Cron envia Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.replace("Bearer ", "").trim();
  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";

  const secretValido = !CRON_SECRET || secret === CRON_SECRET || querySecret === CRON_SECRET;
  if (!secretValido) {
    // Aceita também sessão de admin autenticado (botão no painel)
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const token = await getAccessTokenFromEnv();
  if (!token) return NextResponse.json({ error: "Sem token Drive" }, { status: 500 });

  const log: string[] = [];
  const inicio = Date.now();

  try {
    // 1. Carrega eventos
    const eventosData = await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token);
    const eventos: EventoItem[] = Array.isArray(eventosData) ? eventosData : [];
    const config = lerConfig();
    const corteData = new Date(Date.now() - MAX_DIAS_EVENTO * 24 * 60 * 60 * 1000);

    const eventosAlvo = eventos.filter(e => {
      if (!e.folder_id) return false;
      // Só eventos com até MAX_DIAS_EVENTO de idade (usa data do evento ou criado_em)
      const dataRef = e.data ?? e.criado_em;
      if (dataRef) {
        const dt = new Date(dataRef);
        if (!isNaN(dt.getTime()) && dt < corteData) return false;
      }
      if (config?.eventos !== "todos" && Array.isArray(config?.eventos))
        return config.eventos.includes(e.id);
      return true;
    });

    log.push(`Eventos encontrados: ${eventosAlvo.length}`);

    // 2. Carrega perfis de usuários com descriptor
    const perfisLocal = lerPerfisLocal();
    const perfis: PerfilUsuario[] = perfisLocal.filter(
      p => Array.isArray(p.descriptor) && p.descriptor.length === 128
    );
    log.push(`Perfis com descriptor: ${perfis.length}`);

    if (perfis.length === 0) {
      salvarConfig({ ultimaExecucao: new Date().toISOString(), ultimoLog: "Nenhum perfil com rosto cadastrado." });
      return NextResponse.json({ ok: true, log: ["Nenhum perfil com rosto cadastrado."], duracao: 0 });
    }

    let totalNovosMatches = 0;
    let totalNotificacoes = 0;

    // 3. Para cada evento com índice salvo
    for (const evento of eventosAlvo) {
      try {
        const descData = await lerArquivoOculto<FotoDescritores[]>(ROOT, `_desc_${evento.id}.json`, token);
        if (!Array.isArray(descData) || descData.length === 0) {
          log.push(`[${evento.nome}] Sem índice — pulando`);
          continue;
        }

        // Carrega matches existentes
        const matchesExist = await lerArquivoOculto<ResultadoIndexacao>(ROOT, `_matches_${evento.id}.json`, token);
        const emailsJaNotificados = new Set<string>(
          matchesExist?.usuarios?.map(u => u.email) ?? []
        );

        // 4. Matching: para cada perfil, procura nas fotos do evento
        const novosMatches: MatchUsuarioSalvo[] = [];

        for (const perfil of perfis) {
          if (emailsJaNotificados.has(perfil.email)) continue; // já foi notificado

          const fotosEncontradas: string[] = [];
          for (const foto of descData) {
            for (const rosto of foto.rostos) {
              if (rosto.descriptor.length !== 128) continue;
              const dist = euclidean(perfil.descriptor, rosto.descriptor);
              if (dist < THRESHOLD) {
                fotosEncontradas.push(foto.fotoId);
                break; // uma correspondência por foto é suficiente
              }
            }
          }

          // Exige ao menos 2 fotos para evitar falsos positivos
          if (fotosEncontradas.length >= 2) {
            novosMatches.push({
              email: perfil.email,
              nome: perfil.nome,
              fotosIds: fotosEncontradas,
              thumbUrl: `/api/thumb?id=${fotosEncontradas[0]}&sz=120`,
            });
          }
        }

        log.push(`[${evento.nome}] ${novosMatches.length} novos matches encontrados`);

        if (novosMatches.length === 0) continue;

        totalNovosMatches += novosMatches.length;

        // 5. Atualiza _matches_{eventoId}.json com os novos matches
        const matchesAtualizados: ResultadoIndexacao = {
          eventoId: evento.id,
          eventoNome: evento.nome,
          processadoEm: matchesExist?.processadoEm ?? new Date().toISOString(),
          totalFotos: matchesExist?.totalFotos ?? descData.length,
          fotosComRosto: matchesExist?.fotosComRosto ?? descData.length,
          usuarios: [
            ...(matchesExist?.usuarios ?? []),
            ...novosMatches,
          ],
        };

        await salvarArquivoOculto(ROOT, `_matches_${evento.id}.json`, matchesAtualizados, token);

        // 6. Envia notificações para novos matches
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        for (const m of novosMatches) {
          try {
            const r = await fetch(`${baseUrl}/api/reconhecimento`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // passa secret interno para burlar a verificação de sessão admin
                "x-cron-secret": CRON_SECRET,
              },
              body: JSON.stringify({
                email: m.email,
                nomeEvento: evento.nome,
                eventoSlug: evento.id,
                thumbUrl: m.thumbUrl ? `${baseUrl}${m.thumbUrl}` : undefined,
              }),
            });
            if (r.ok) totalNotificacoes++;
          } catch { /* continua */ }
        }
      } catch (e) {
        log.push(`[${evento.nome}] Erro: ${String(e)}`);
      }
    }

    const duracao = Math.round((Date.now() - inicio) / 1000);
    const resumo = `${totalNovosMatches} novos matches, ${totalNotificacoes} notificações. ${duracao}s`;
    log.push(resumo);

    salvarConfig({
      ultimaExecucao: new Date().toISOString(),
      ultimoLog: resumo,
    });

    // ── Detecta eventos com fotos novas → escreve flags para o admin ──
    const flags: { eventoId: string; eventoNome: string; fotosIndex: number; fotosTotal: number; novas: number; detectadoEm: string }[] = [];
    for (const evento of eventosAlvo) {
      try {
        const descData = await lerArquivoOculto<{ fotoId: string }[]>(ROOT, `_desc_${evento.id}.json`, token);
        const fotosIndex = Array.isArray(descData) ? descData.length : 0;
        if (fotosIndex === 0) continue; // não indexado ainda — ignora
        // Conta fotos reais no Drive
        const listUrl = `https://www.googleapis.com/drive/v3/files?q='${evento.folder_id}'+in+parents+and+mimeType+contains+'image/'&fields=files(id)&pageSize=1000`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!listRes.ok) continue;
        const listData = await listRes.json();
        const fotosTotal: number = (listData.files ?? []).length;
        const novas = fotosTotal - fotosIndex;
        if (novas > 0) {
          flags.push({ eventoId: evento.id, eventoNome: evento.nome, fotosIndex, fotosTotal, novas, detectadoEm: new Date().toISOString() });
        }
      } catch { /* ignora evento com erro */ }
    }
    if (flags.length > 0) {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await fetch(`${baseUrl}/api/indexacao/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
        body: JSON.stringify(flags),
      }).catch(() => {});
      log.push(`${flags.length} evento(s) com fotos novas detectados`);
    }

    return NextResponse.json({ ok: true, totalNovosMatches, totalNotificacoes, duracao, flagsDetectados: flags.length, log });
  } catch (e) {
    const msg = String(e);
    salvarConfig({ ultimoLog: `Erro: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
