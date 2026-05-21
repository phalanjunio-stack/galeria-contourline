// Cliente Drive API (REST) — replica lib/drive.ts do Next.js
import { getAccessToken } from "./auth.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function headers() {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function listarFotosPasta(folderId) {
  // Query simples (sem filtro de mimetype — shared drives nao tratam 'contains' direito)
  // Filtramos em JS depois.
  const todos = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,thumbnailLink,createdTime,size)",
      pageSize: "1000",
      orderBy: "createdTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${DRIVE_API}/files?${params}`, { headers: await headers() });
    if (!res.ok) throw new Error(`Drive listar: ${res.status}`);
    const data = await res.json();
    todos.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  // Filtra: so imagens, sem nomes ocultos
  return todos.filter(
    (f) =>
      f.mimeType &&
      f.mimeType.startsWith("image/") &&
      !f.name.startsWith("_")
  );
}

export async function lerArquivoOculto(folderId, fileName) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id,name)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });
  const searchRes = await fetch(`${DRIVE_API}/files?${params}`, { headers: await headers() });
  const searchData = await searchRes.json();
  if (!searchData.files?.length) return null;

  const fileId = searchData.files[0].id;
  const contentRes = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: await headers() }
  );
  if (!contentRes.ok) return null;
  return contentRes.json();
}

export async function salvarArquivoOculto(folderId, fileName, data) {
  // Procura existente
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });
  const searchRes = await fetch(`${DRIVE_API}/files?${params}`, { headers: await headers() });
  const searchData = await searchRes.json();
  const existingId = searchData.files?.[0]?.id;

  const content = JSON.stringify(data, null, 2);
  const token = await getAccessToken();

  if (existingId) {
    // Atualiza com upload simples
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media&supportsAllDrives=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: content,
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive PATCH ${fileName}: ${res.status} — ${body.slice(0, 200)}`);
    }
    return;
  }

  // Cria novo com multipart
  const boundary = `boundary_${Date.now()}`;
  const metadata = { name: fileName, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive POST ${fileName}: ${res.status} — ${body.slice(0, 300)}`);
  }
}

// Baixa o conteudo binario de uma foto (Buffer)
export async function baixarFoto(fileId) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download ${fileId}: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Baixa thumbnail compacto (mais rapido, suficiente pra deteccao)
// Se thumbnailLink já foi obtido na listagem, passar pra evitar 1 fetch de meta.
export async function baixarThumb(fileId, size = 640, thumbnailLink = null) {
  // Caminho rápido: temos o link, baixa direto
  if (thumbnailLink) {
    const thumbUrl = thumbnailLink.replace(/=s\d+$/, `=s${size}`);
    const imgRes = await fetch(thumbUrl);
    if (imgRes.ok) {
      const arrayBuffer = await imgRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    // Cai pro fallback abaixo
  }

  // Caminho legado: pega link via meta + baixa
  const token = await getAccessToken();
  const metaRes = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=thumbnailLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) throw new Error(`Drive meta ${fileId}: ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta.thumbnailLink) return baixarFoto(fileId);
  const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  const imgRes = await fetch(thumbUrl);
  if (!imgRes.ok) throw new Error(`Drive thumb ${fileId}: ${imgRes.status}`);
  const arrayBuffer = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
