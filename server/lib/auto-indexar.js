// Loop de auto-indexacao: verifica eventos periodicamente e processa fotos novas.
import fs from "node:fs/promises";
import path from "node:path";
import { listarFotosPasta } from "./drive.js";
import { lerArquivo } from "./storage.js";
import { novoJob, indexarEvento, getJob } from "./indexar.js";

const INTERVAL_MS = parseInt(process.env.AUTO_INDEX_INTERVAL_MIN || "30") * 60_000;
const EVENTOS_PATH = process.env.EVENTOS_PATH || path.resolve("..", "data", "eventos.json");
const PERFIS_PATH = process.env.PERFIS_PATH || path.resolve("..", "data", "perfis.json");

let rodando = false;

const autoStatus = {
  enabled: process.env.AUTO_INDEX_ENABLED === "1",
  intervalMin: INTERVAL_MS / 60000,
  catalogoRemoto: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  iniciadoEm: null,
  rodando: false,
  ultimoCiclo: null,
};

export function getAutoIndexStatus() {
  return JSON.parse(JSON.stringify(autoStatus));
}

function statusEvento(evento, status, motivo, extra = {}) {
  return {
    eventoId: evento.id,
    nome: evento.nome,
    status,
    motivo,
    ...extra,
  };
}

async function lerJSON(p) {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[auto] Falha ao ler ${p}: ${err.message}`);
    return null;
  }
}

async function lerCatalogoRemoto() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.SERVER_SECRET;
  if (!siteUrl || !secret) return null;

  try {
    const res = await fetch(`${siteUrl}/api/indexar/catalogo`, {
      headers: { "X-Server-Secret": secret },
    });
    if (!res.ok) {
      console.warn(`[auto] Catalogo da galeria falhou: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data?.eventos) || !Array.isArray(data?.perfis)) return null;
    console.log("[auto] Catalogo carregado da galeria");
    return data;
  } catch (err) {
    console.warn(`[auto] Catalogo da galeria indisponivel: ${err.message}`);
    return null;
  }
}

async function lerCatalogo() {
  const remoto = await lerCatalogoRemoto();
  if (remoto) return remoto;

  const [eventos, perfis] = await Promise.all([
    lerJSON(EVENTOS_PATH),
    lerJSON(PERFIS_PATH),
  ]);
  return {
    eventos: Array.isArray(eventos) ? eventos : [],
    perfis: Array.isArray(perfis) ? perfis : [],
  };
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
      };
    }

    if (Array.isArray(descritores) && totalDrive === totalIndexado) {
      const idsDrive = new Set(fotosDrive.map((f) => f.id));
      const removidas = descritores.filter((d) => !idsDrive.has(d.fotoId)).length;
      if (removidas > 0) {
        return { precisa: true, motivo: `${removidas} fotos foram apagadas` };
      }
    }

    return { precisa: false, motivo: "ja indexado" };
  } catch (err) {
    return { precisa: false, motivo: `erro: ${err.message}` };
  }
}

function perfisComDescritores(perfis) {
  return perfis
    .filter((p) => {
      const descs = p.descriptors?.length ? p.descriptors : p.descriptor ? [p.descriptor] : [];
      return descs.length > 0;
    })
    .map((p) => ({
      email: p.email,
      nome: p.nome,
      descriptors: p.descriptors?.length ? p.descriptors : [p.descriptor],
      thumb: p.thumb || p.foto_rastreio || null,
    }));
}

async function tick() {
  if (rodando) {
    console.log("[auto] Ciclo pulado - job ainda rodando");
    autoStatus.ultimoCiclo = {
      iniciadoEm: new Date().toISOString(),
      terminadoEm: new Date().toISOString(),
      pulado: true,
      erro: "Job de indexacao ainda rodando",
      eventosTotal: 0,
      perfisProntos: 0,
      eventos: [],
    };
    return;
  }

  const ciclo = {
    iniciadoEm: new Date().toISOString(),
    terminadoEm: null,
    pulado: false,
    erro: null,
    eventosTotal: 0,
    perfisProntos: 0,
    eventos: [],
  };
  autoStatus.ultimoCiclo = ciclo;
  autoStatus.rodando = true;
  console.log(`\n[auto] === Ciclo automatico ${new Date().toLocaleString("pt-BR")} ===`);
  try {
    const { eventos, perfis } = await lerCatalogo();
    ciclo.eventosTotal = eventos.length;
    if (!eventos.length) {
      console.log("[auto] Sem eventos acessiveis - pulando ciclo");
      ciclo.erro = "Sem eventos acessiveis";
      return;
    }

    const perfisProntos = perfisComDescritores(perfis);
    ciclo.perfisProntos = perfisProntos.length;
    console.log(`[auto] ${eventos.length} eventos, ${perfisProntos.length} perfis com descritor`);

    for (const evento of eventos) {
      if (evento.status === "encerrado") {
        ciclo.eventos.push(statusEvento(evento, "ignorado", "evento encerrado"));
        continue;
      }

      const { precisa, motivo } = await precisaIndexar(evento);
      console.log(`[auto] ${evento.nome}: ${motivo}`);
      if (!precisa) {
        ciclo.eventos.push(statusEvento(
          evento,
          motivo.startsWith("erro:") ? "erro" : "ok",
          motivo
        ));
        continue;
      }

      const job = novoJob(evento.id, evento.nome, evento.folder_id);
      const registro = statusEvento(evento, "indexando", motivo, { jobId: job.jobId });
      ciclo.eventos.push(registro);
      console.log(`[auto] Indexando ${evento.nome} (job ${job.jobId})`);
      rodando = true;
      try {
        await indexarEvento(job.jobId, perfisProntos);
        const finalJob = getJob(job.jobId);
        registro.status = "indexado";
        registro.matches = finalJob?.matches || 0;
        registro.fotosComRosto = finalJob?.fotosComRosto || 0;
        console.log(
          `[auto] ${evento.nome} concluido: ${registro.matches} matches, ${registro.fotosComRosto} com rosto`
        );
      } catch (err) {
        registro.status = "erro";
        registro.motivo = err.message;
        console.error(`[auto] ${evento.nome} falhou:`, err.message);
      } finally {
        rodando = false;
      }
    }
  } catch (err) {
    ciclo.erro = err.message;
    console.error("[auto] Ciclo falhou:", err.message);
  } finally {
    ciclo.terminadoEm = new Date().toISOString();
    autoStatus.rodando = rodando;
    console.log("[auto] === Ciclo finalizado ===\n");
  }
}

export function iniciarAutoIndexacao() {
  const enabled = process.env.AUTO_INDEX_ENABLED === "1";
  autoStatus.enabled = enabled;
  autoStatus.iniciadoEm = new Date().toISOString();
  if (!enabled) {
    console.log("[auto] AUTO_INDEX_ENABLED nao=1 - auto-indexacao desligada");
    return;
  }

  console.log(`[auto] Iniciando ciclo automatico a cada ${INTERVAL_MS / 60000} min`);
  console.log(`[auto] Catalogo remoto=${process.env.NEXT_PUBLIC_SITE_URL ? "galeria" : "desligado"}`);
  setTimeout(() => tick().catch(console.error), 30_000);
  setInterval(() => tick().catch(console.error), INTERVAL_MS);
}
