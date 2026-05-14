// Logica principal de indexacao facial
import { listarFotosPasta, baixarThumb } from "./drive.js";
import { lerArquivo, salvarArquivo } from "./storage.js";
import { detectarRostos, distanceEuclidean } from "./face.js";

// Parametros (mesmos do client-side)
const THRESHOLD_MATCH = 0.55;
const CLUSTER_THRESHOLD = 0.50;
const LOTE = 2; // Render Free CPU eh fraca, processa de 2 em 2
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
    job.fase = "detectando_rostos";
    for (let i = 0; i < fotosParaProcessar.length; i += LOTE) {
      const lote = fotosParaProcessar.slice(i, i + LOTE);
      const resultados = await Promise.all(
        lote.map(async (foto) => {
          try {
            const buf = await baixarThumb(foto.id, 800);
            const rostos = await detectarRostos(buf);
            return { fotoId: foto.id, rostos };
          } catch (err) {
            console.warn(`[job ${jobId}] foto ${foto.id} falhou:`, err.message);
            return { fotoId: foto.id, rostos: [] };
          }
        })
      );
      descriptors.push(...resultados);
      job.fotosProcessadas += lote.length;

      // Salvamento parcial periodico
      const desdeUltimoSave = job.fotosProcessadas % SAVE_A_CADA;
      if (desdeUltimoSave < LOTE) {
        await salvarArquivo(
          job.folderId,
          `_desc_${job.eventoId}.json`,
          descriptors
        );
        console.log(`[job ${jobId}] Salvo parcial (${job.fotosProcessadas}/${fotos.length})`);
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
          thumbUrl: perfil.thumb || null,
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
