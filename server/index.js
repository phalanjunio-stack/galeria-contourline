// Servidor Express: endpoints de indexacao facial
import express from "express";
import { initFaceApi } from "./lib/face.js";
import { novoJob, getJob, indexarEvento } from "./lib/indexar.js";
import { iniciarAutoIndexacao } from "./lib/auto-indexar.js";

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

// Debug: retorna info da conta autenticada + lista de uma pasta
app.get("/debug/conta", exigirSecret, async (req, res) => {
  try {
    const { getAccessToken } = await import("./lib/auth.js");
    const token = await getAccessToken();
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userInfo = await r.json();
    res.json({ ok: true, conta: userInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/debug/pasta/:folderId", exigirSecret, async (req, res) => {
  try {
    const { getAccessToken } = await import("./lib/auth.js");
    const token = await getAccessToken();
    const folderId = req.params.folderId;
    // Query 1: nosso filtro padrao
    const q1 = `'${folderId}' in parents and mimeType contains 'image/' and not name contains '_' and trashed = false`;
    const r1 = await fetch(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
        q: q1,
        fields: "files(id,name,mimeType),incompleteSearch",
        pageSize: "5",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      })}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d1 = await r1.json();
    // Query 2: sem filtro de tipo, so pra ver se acha qualquer coisa
    const q2 = `'${folderId}' in parents and trashed = false`;
    const r2 = await fetch(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
        q: q2,
        fields: "files(id,name,mimeType),incompleteSearch",
        pageSize: "5",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      })}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d2 = await r2.json();
    // Query 3: metadata da propria pasta
    const r3 = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,driveId,owners,permissions&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d3 = await r3.json();
    res.json({
      folderId,
      pasta: d3,
      comFiltroImg: { status: r1.status, ...d1 },
      semFiltro: { status: r2.status, ...d2 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    iniciarAutoIndexacao();
  });
})();
