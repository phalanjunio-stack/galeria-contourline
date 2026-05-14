// Loop de auto-indexacao: roda periodicamente, verifica eventos
// e indexa automaticamente os que tem fotos novas.
import fs from "node:fs/promises";
import path from "node:path";
import { listarFotosPasta } from "./drive.js";
import { lerArquivo } from "./storage.js";
import { novoJob, indexarEvento, getJob } from "./indexar.js";

const INTERVAL_MS = parseInt(process.env.AUTO_INDEX_INTERVAL_MIN || "30") * 60_000;
// Caminho dos JSONs do Next.js (../data/ relativo ao server)
const EVENTOS_PATH = process.env.EVENTOS_PATH || path.resolve("..", "data", "eventos.json");
const PERFIS_PATH = process.env.PERFIS_PATH || path.resolve("..", "data", "perfis.json");

let rodando = false;

async function lerJSON(p) {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[auto] Falha ao ler ${p}: ${err.message}`);
    return null;
  }
}

async function precisaIndexar(evento) {
  if (!evento.folder_id) return { precisa: false, motivo: "sem folder_id" };

  try {
    const [fotosDrive, descritores] = await Promise.all([
      listarFotosPasta(evento.folder_id),
      lerArquivo(evento.folder_id, `_desc_${evento.id}.json`),
    ]);

    const totalDrive = fotosDrive.length;
    const totalIndexado = Array.isArray(descritores) ? descritores.length : 0;

    if (totalIndexado < totalDrive) {
      return {
        precisa: true,
        motivo: `${totalDrive - totalIndexado} fotos sem indexar (${totalIndexado}/${totalDrive})`,
        totalDrive,
        totalIndexado,
      };
    }

    // Check de IDs (se totais batem mas IDs diferentes)
    if (Array.isArray(descritores) && totalDrive === totalIndexado) {
      const idsDrive = new Set(fotosDrive.map((f) => f.id));
      const faltam = descritores.filter((d) => !idsDrive.has(d.fotoId)).length;
      if (faltam > 0) {
        return { precisa: true, motivo: `${faltam} fotos foram apagadas` };
      }
    }

    return { precisa: false, motivo: "ja indexado" };
  } catch (err) {
    return { precisa: false, motivo: `erro: ${err.message}` };
  }
}

async function tick() {
  if (rodando) {
    console.log("[auto] Tick pulado — job ainda rodando");
    return;
  }
  console.log(`\n[auto] === Ciclo automatico ${new Date().toLocaleString("pt-BR")} ===`);

  const eventos = await lerJSON(EVENTOS_PATH);
  if (!Array.isArray(eventos)) {
    console.log("[auto] Sem eventos.json acessivel — pulando ciclo");
    return;
  }

  const perfis = (await lerJSON(PERFIS_PATH)) || [];
  const perfisComDesc = perfis
    .filter((p) => {
      const descs = p.descriptors?.length ? p.descriptors : p.descriptor ? [p.descriptor] : [];
      return descs.length > 0;
    })
    .map((p) => ({
      email: p.email,
      nome: p.nome,
      descriptors: p.descriptors?.length ? p.descriptors : [p.descriptor],
      thumb: p.foto_rastreio || null,
    }));

  console.log(`[auto] ${eventos.length} eventos, ${perfisComDesc.length} perfis com descritor`);

  for (const evento of eventos) {
    if (evento.status === "encerrado") continue;

    const { precisa, motivo } = await precisaIndexar(evento);
    console.log(`[auto] ${evento.nome}: ${motivo}`);

    if (precisa) {
      const job = novoJob(evento.id, evento.nome, evento.folder_id);
      console.log(`[auto] → Indexando ${evento.nome} (job ${job.jobId})`);
      rodando = true;
      try {
        await indexarEvento(job.jobId, perfisComDesc);
        const finalJob = getJob(job.jobId);
        console.log(
          `[auto] ✓ ${evento.nome} concluido: ${finalJob?.matches || 0} matches, ${
            finalJob?.fotosComRosto || 0
          } com rosto`
        );
      } catch (err) {
        console.error(`[auto] ✗ ${evento.nome} falhou:`, err.message);
      } finally {
        rodando = false;
      }
    }
  }

  console.log("[auto] === Ciclo finalizado ===\n");
}

export function iniciarAutoIndexacao() {
  const enabled = process.env.AUTO_INDEX_ENABLED === "1";
  if (!enabled) {
    console.log("[auto] AUTO_INDEX_ENABLED nao=1 — auto-indexacao desligada");
    return;
  }
  console.log(`[auto] Iniciando ciclo automatico a cada ${INTERVAL_MS / 60000} min`);
  console.log(`[auto] EVENTOS_PATH=${EVENTOS_PATH}`);
  console.log(`[auto] PERFIS_PATH=${PERFIS_PATH}`);
  // Primeira execucao em 30s (deixa o server estabilizar)
  setTimeout(() => tick().catch(console.error), 30_000);
  setInterval(() => tick().catch(console.error), INTERVAL_MS);
}
