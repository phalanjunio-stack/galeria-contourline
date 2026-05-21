// Script one-shot: envia data/eventos.json para o Drive como _index.json
// Uso: node server/scripts/sync-eventos.js
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env
try {
  const env = readFileSync(resolve(__dirname, "..", ".env"), "utf-8");
  for (const linha of env.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /**/ }

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID;
if (!ROOT) { console.error("DRIVE_ROOT_FOLDER_ID nao definido no .env"); process.exit(1); }

// Lê eventos.json local
const eventosPath = resolve(__dirname, "..", "..", "data", "eventos.json");
const eventos = JSON.parse(readFileSync(eventosPath, "utf-8"));
console.log(`[sync] ${eventos.length} eventos encontrados em eventos.json`);

// Obtém token OAuth
async function getToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(`Token falhou: ${JSON.stringify(d)}`);
  return d.access_token;
}

// Verifica se _index.json já existe no ROOT
async function findExisting(token) {
  const params = new URLSearchParams({
    q: `'${ROOT}' in parents and name = '_index.json' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await res.json();
  return d.files?.[0]?.id ?? null;
}

async function main() {
  const token = await getToken();
  console.log("[sync] Token obtido");

  const existingId = await findExisting(token);
  const content = JSON.stringify(eventos, null, 2);

  if (existingId) {
    console.log(`[sync] _index.json já existe (${existingId}) — atualizando...`);
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media&supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: content,
      }
    );
    if (!res.ok) throw new Error(`PATCH falhou: ${res.status} ${await res.text()}`);
    console.log("[sync] ✅ _index.json atualizado no Drive!");
  } else {
    console.log("[sync] _index.json não existe — criando...");
    const boundary = `b_${Date.now()}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify({ name: "_index.json", parents: [ROOT] })}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${content}\r\n--${boundary}--`;

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) throw new Error(`POST falhou: ${res.status} ${await res.text()}`);
    console.log("[sync] ✅ _index.json criado no Drive!");
  }

  console.log(`[sync] Eventos sincronizados: ${eventos.map(e => e.nome).join(", ")}`);
}

main().catch(e => { console.error("[sync] ERRO:", e.message); process.exit(1); });
