// Loader simples: carrega .env e inicia o servidor
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Le .env e injeta em process.env
try {
  const envContent = readFileSync(resolve(__dirname, ".env"), "utf-8");
  for (const linha of envContent.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
} catch (err) {
  console.warn("[start] Nao foi possivel ler .env:", err.message);
}

// Importa o servidor (start automatico via IIFE no index.js)
await import("./index.js");
