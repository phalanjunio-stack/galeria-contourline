// Armazenamento com fallback local:
// Tenta Drive primeiro; se falhar com 403/permissao, usa disco local.
// Disco local: ../data/descritores/{folderId}/{fileName}
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  lerArquivoOculto as lerDrive,
  salvarArquivoOculto as salvarDrive,
} from "./drive.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_LOCAL = path.resolve(__dirname, "..", "..", "data", "descritores");

function caminhoLocal(folderId, fileName) {
  return path.join(BASE_LOCAL, folderId, fileName);
}

async function lerLocal(folderId, fileName) {
  try {
    const raw = await fs.readFile(caminhoLocal(folderId, fileName), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function salvarLocal(folderId, fileName, data) {
  const dir = path.join(BASE_LOCAL, folderId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    caminhoLocal(folderId, fileName),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
  console.log(`[storage] Salvo local: ${path.join(folderId, fileName)}`);
}

// Le de Drive; se nao encontrar, tenta disco local.
export async function lerArquivo(folderId, fileName) {
  try {
    const data = await lerDrive(folderId, fileName);
    if (data !== null) return data;
  } catch (err) {
    console.warn(`[storage] Drive ler falhou (${err.message}), tentando local...`);
  }
  return lerLocal(folderId, fileName);
}

// Salva no Drive; se falhar com 403 ou permissao, salva local.
export async function salvarArquivo(folderId, fileName, data) {
  try {
    await salvarDrive(folderId, fileName, data);
    // Sucesso no Drive — apaga copia local antiga se existir
    try {
      await fs.unlink(caminhoLocal(folderId, fileName));
    } catch {
      /* nao existia */
    }
  } catch (err) {
    const is403 =
      err.message.includes("403") ||
      err.message.toLowerCase().includes("insufficient") ||
      err.message.toLowerCase().includes("permission");

    if (is403) {
      console.warn(
        `[storage] Drive sem permissao de escrita (${err.message.slice(0, 80)}). Salvando local.`
      );
      await salvarLocal(folderId, fileName, data);
    } else {
      throw err; // Outro erro — propaga normalmente
    }
  }
}
