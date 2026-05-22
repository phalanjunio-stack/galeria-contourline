// Logica principal de indexacao facial
import { listarFotosPasta, baixarThumb } from "./drive.js";
import { lerArquivo, salvarArquivo } from "./storage.js";
import { detectarRostos, distanceEuclidean } from "./face.js";
import { substituirIndiceEvento } from "./face-index-db.js";

// Parametros (mesmos do client-side)
const THRESHOLD_MATCH_ENV = Number(process.env.FACE_MATCH_THRESHOLD || 0.52);
const THRESHOLD_MATCH = Number.isFinite(THRESHOLD_MATCH_ENV)
  ? Math.min(0.65, Math.max(0.35, THRESHOLD_MATCH_ENV))
  : 0.52;
const CLUSTER_THRESHOLD = 0.50;
// Concurrencia configuravel — Render Free CPU = 2-3, plano pago = 6-8, local = 8-12
const LOTE = Number(process.env.INDEX_BATCH_SIZE || 4);
const THUMB_SIZE = Number(process.env.INDEX_THUMB_SIZE || 640);
const SAVE_A_CADA = 16; // Salva parcial a cada 16 fotos

// Jobs em memoria (chave: jobId)
const jobs = new Map();

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function novoJob(eventoId, eventoNome, folderId) {
  const jobId = `${eventoId}_${Date.now()}`;
  const job = {
    jobId,
    eventoId,
    eventoNome,
    folderId,
    status: "running", // running | done | error
    fase: "iniciando",
    iniciadoEm: new Date().toISOString(),
    fotosProcessadas: 0,
    fotosTotal: 0,
    fotosComRosto: 0,
    rostosDetectados: 0,
    usuariosCadastrados: 0,
    matches: 0,
    notificacoes: 0,
    erro: null,
  };
  jobs.set(jobId, job);
  return job;
}

export async function indexarEvento(jobId, perfis) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} nao encontrado`);

  try {
    // ─── Fase 1: Listar fotos ─────────────────────────────────────
    job.fase = "listando_fotos";
    const fotos = await listarFotosPasta(job.folderId);
    job.fotosTotal = fotos.length;
    job.usuariosCadastrados = perfis.length;
    console.log(`[job ${jobId}] ${fotos.length} fotos, ${perfis.length} perfis`);

    // ─── Fase 2: Recuperar progresso parcial ──────────────────────
    job.fase = "recuperando_progresso";
    const descPrevios =
      (await lerArquivo(job.folderId, `_desc_${job.eventoId}.json`)) || [];
    const idsJaProcessados = new Set(descPrevios.map((d) => d.fotoId));
    const fotosParaProcessar = fotos.filter(
      (f) => !idsJaProcessados.has(f.id)
    );
    const descriptors = [...descPrevios];
    job.fotosProcessadas = descPrevios.length;
    console.log(
      `[job ${jobId}] Ja processadas: ${descPrevios.length}, faltam: ${fotosParaProcessar.length}`
    );

    // ─── Fase 3: Detectar rostos ──────────────────────────────────
    // PIPELINE: enquanto o lote N está sendo DETECTADO, já BAIXA o lote N+1
    job.fase = "detectando_rostos";
    console.log(`[job ${jobId}] LOTE=${LOTE} THUMB=${THUMB_SIZE}px`);
    const tBaseline = Date.now();

    // Helper: baixa buffers de um lote em paralelo (passa thumbnailLink direto)
    const baixarLote = (lote) =>
      Promise.all(
        lote.map(async (foto) => {
          try {
            const buf = await baixarThumb(foto.id, THUMB_SIZE, foto.thumbnailLink);
            return { foto, buf, err: null };
          } catch (err) {
            return { foto, buf: null, err };
          }
        })
      );

    // Helper: detecta rostos de um lote já baixado
    const detectarLote = (loteBaixado) =>
      Promise.all(
        loteBaixado.map(async ({ foto, buf, err }) => {
          if (err || !buf) {
            console.warn(`[job ${jobId}] foto ${foto.id} download falhou:`, err?.message);
            return { fotoId: foto.id, rostos: [] };
          }
          try {
            const rostos = await detectarRostos(buf);
            return { fotoId: foto.id, rostos };
          } catch (err2) {
            console.warn(`[job ${jobId}] foto ${foto.id} detect falhou:`, err2.message);
            return { fotoId: foto.id, rostos: [] };
          }
        })
      );

    // Inicia primeiro lote
    let proxLoteBaixado = baixarLote(fotosParaProcessar.slice(0, LOTE));

    for (let i = 0; i < fotosParaProcessar.length; i += LOTE) {
      const loteBaixado = await proxLoteBaixado;
      // Já dispara o download do próximo enquanto detecta o atual
      proxLoteBaixado = i + LOTE < fotosParaProcessar.length
        ? baixarLote(fotosParaProcessar.slice(i + LOTE, i + 2 * LOTE))
        : Promise.resolve([]);

      const resultados = await detectarLote(loteBaixado);
      descriptors.push(...resultados);
      job.fotosProcessadas += loteBaixado.length;

      // Salvamento parcial periódico
      const desdeUltimoSave = job.fotosProcessadas % SAVE_A_CADA;
      if (desdeUltimoSave < LOTE) {
        await salvarArquivo(
          job.folderId,
          `_desc_${job.eventoId}.json`,
          descriptors
        );
        const dt = ((Date.now() - tBaseline) / 1000).toFixed(1);
        const rate = (job.fotosProcessadas / Math.max(1, parseFloat(dt))).toFixed(2);
        console.log(`[job ${jobId}] ${job.fotosProcessadas}/${fotos.length} (${dt}s, ${rate} fotos/s)`);
      }
    }

    // Salvamento final dos descritores
    await salvarArquivo(
      job.folderId,
      `_desc_${job.eventoId}.json`,
      descriptors
    );
    job.fotosComRosto = descriptors.filter((d) => d.rostos.length > 0).length;
    job.rostosDetectados = descriptors.reduce((s, d) => s + d.rostos.length, 0);

    // ─── Fase 4: Matching com usuarios ────────────────────────────
    job.fase = "fazendo_matches";
    const usuariosMatches = [];
    for (const perfil of perfis) {
      const descritoresPerfil =
        perfil.descriptors && perfil.descriptors.length > 0
          ? perfil.descriptors
          : perfil.descriptor
          ? [perfil.descriptor]
          : [];
      if (descritoresPerfil.length === 0) continue;

      const fotosIds = [];
      for (const foto of descriptors) {
        for (const rosto of foto.rostos) {
          const menorDist = Math.min(
            ...descritoresPerfil.map((d) => distanceEuclidean(d, rosto.descriptor))
          );
          if (menorDist <= THRESHOLD_MATCH) {
            fotosIds.push(foto.fotoId);
            break;
          }
        }
      }

      if (fotosIds.length > 0) {
        usuariosMatches.push({
          email: perfil.email,
          nome: perfil.nome,
          fotosIds,
          thumbUrl: `/api/thumb?id=${fotosIds[0]}&sz=120`,
        });
      }
    }
    job.matches = usuariosMatches.length;

    // ─── Fase 5: Salvar matches ───────────────────────────────────
    job.fase = "salvando_matches";
    await salvarArquivo(job.folderId, `_matches_${job.eventoId}.json`, {
      eventoId: job.eventoId,
      eventoNome: job.eventoNome,
      processadoEm: new Date().toISOString(),
      totalFotos: fotos.length,
      fotosComRosto: job.fotosComRosto,
      usuarios: usuariosMatches,
    });

    // ─── Fase 6: Clustering de pessoas (versao simples) ───────────
    job.fase = "clusterizando";
    const clusters = clusterizarRostos(descriptors);
    await salvarArquivo(job.folderId, `_pessoas_${job.eventoId}.json`, {
      eventoId: job.eventoId,
      processadoEm: new Date().toISOString(),
      threshold: CLUSTER_THRESHOLD,
      clusters,
    });

    // PostgreSQL e o indice de busca novo; JSON fica como fallback compativel.
    job.fase = "salvando_pgvector";
    await substituirIndiceEvento({
      eventoId: job.eventoId,
      eventoNome: job.eventoNome,
      folderId: job.folderId,
      descriptors,
      clusters,
      totalFotos: fotos.length,
      fotosComRosto: job.fotosComRosto,
      rostosDetectados: job.rostosDetectados,
    });

    job.fase = "notificando";
    job.notificacoes = await notificarMatches(job, fotos.length, usuariosMatches);

    job.fase = "concluido";
    job.status = "done";
    job.terminadoEm = new Date().toISOString();
    console.log(`[job ${jobId}] CONCLUIDO: ${job.matches} matches`);
  } catch (err) {
    console.error(`[job ${jobId}] ERRO:`, err);
    job.status = "error";
    job.erro = err.message;
    job.terminadoEm = new Date().toISOString();
  }
}

async function notificarMatches(job, totalFotos, usuarios) {
  if (!usuarios.length) return 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.warn(`[job ${job.jobId}] NEXT_PUBLIC_SITE_URL ausente; notificacoes puladas`);
    return 0;
  }

  try {
    const res = await fetch(`${siteUrl}/api/indexar/notificar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SERVER_SECRET ? { "X-Server-Secret": process.env.SERVER_SECRET } : {}),
      },
      body: JSON.stringify({
        eventoId: job.eventoId,
        eventoNome: job.eventoNome,
        totalFotos,
        fotosComRosto: job.fotosComRosto,
        usuarios,
      }),
    });
    if (!res.ok) {
      console.warn(`[job ${job.jobId}] Notificacoes falharam: HTTP ${res.status} ${await res.text()}`);
      return 0;
    }
    const data = await res.json();
    const total = Number(data?.notificacoes) || 0;
    console.log(`[job ${job.jobId}] Notificacoes no sininho: ${total}/${usuarios.length}`);
    return total;
  } catch (err) {
    console.warn(`[job ${job.jobId}] Notificacoes falharam: ${err.message}`);
    return 0;
  }
}

// Clustering greedy simples: agrupa rostos com distancia < threshold
function clusterizarRostos(descriptors) {
  const clusters = [];
  let nextId = 1;

  for (const foto of descriptors) {
    for (const rosto of foto.rostos) {
      // Acha cluster compativel
      let cluster = null;
      for (const c of clusters) {
        const dist = distanceEuclidean(c.descritor_medio, rosto.descriptor);
        if (dist < CLUSTER_THRESHOLD) {
          cluster = c;
          break;
        }
      }

      if (cluster) {
        // Adiciona ao cluster: atualiza media incremental
        if (!cluster.fotos.includes(foto.fotoId)) cluster.fotos.push(foto.fotoId);
        cluster.rostosDetectados++;
        // Media incremental: novaMedia = (mediaAnt * (n-1) + novo) / n
        for (let i = 0; i < cluster.descritor_medio.length; i++) {
          cluster.descritor_medio[i] =
            (cluster.descritor_medio[i] * (cluster.rostosDetectados - 1) +
              rosto.descriptor[i]) /
            cluster.rostosDetectados;
        }
      } else {
        clusters.push({
          clusterId: `p_${String(nextId++).padStart(3, "0")}`,
          descritor_medio: [...rosto.descriptor],
          fotos: [foto.fotoId],
          rostosDetectados: 1,
        });
      }
    }
  }

  return clusters;
}
