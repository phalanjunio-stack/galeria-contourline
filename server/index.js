// Servidor Express: endpoints de indexacao facial
import express from "express";
import { initFaceApi } from "./lib/face.js";
import { novoJob, getJob, indexarEvento } from "./lib/indexar.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

// CORS — permite chamadas do site Next.js (Vercel/localhost)
app.use((req, res, next) => {
  const origem = req.headers.origin || "";
  const permitidas = [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);
  if (permitidas.includes(origem) || permitidas.some((p) => origem.startsWith(p))) {
    res.setHeader("Access-Control-Allow-Origin", origem);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Server-Secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Auth simples: header X-Server-Secret == SERVER_SECRET
function exigirSecret(req, res, next) {
  const secret = process.env.SERVER_SECRET;
  if (!secret) return next(); // sem secret configurado → libera (dev)
  if (req.headers["x-server-secret"] !== secret) {
    return res.status(401).json({ error: "Nao autorizado" });
  }
  next();
}

// ─── Endpoints ─────────────────────────────────────────────────────

// Health check (Render usa isso pra manter servico vivo)
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: Date.now() });
});

// Inicia um job de indexacao (responde imediato)
app.post("/indexar", exigirSecret, async (req, res) => {
  const { eventoId, eventoNome, folderId, perfis } = req.body || {};
  if (!eventoId || !folderId) {
    return res.status(400).json({ error: "Faltam eventoId/folderId" });
  }
  if (!Array.isArray(perfis)) {
    return res.status(400).json({ error: "Faltam perfis (array)" });
  }

  const job = novoJob(eventoId, eventoNome || eventoId, folderId);
  // Dispara em background — NAO espera terminar
  indexarEvento(job.jobId, perfis).catch((err) => {
    console.error("Erro background:", err);
  });

  res.json({ jobId: job.jobId, status: "started" });
});

// Consulta status de um job
app.get("/status/:jobId", exigirSecret, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job nao encontrado" });
  res.json(job);
});

// Lista todos os jobs (debug)
app.get("/jobs", exigirSecret, (req, res) => {
  res.json({ ts: Date.now() });
});

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;

(async () => {
  console.log("[boot] Carregando modelos face-api...");
  await initFaceApi();
  app.listen(PORT, () => {
    console.log(`[boot] Servidor pronto em http://localhost:${PORT}`);
  });
})();
