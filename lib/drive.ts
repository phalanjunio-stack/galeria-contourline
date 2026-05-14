// Integração com Google Drive API
// As fotos ficam no Drive. Os JSONs ocultos (_evento.json, _rostos.json, _usuarios.json)
// ficam na mesma pasta, marcados como ocultos (nome começa com _).

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  createdTime?: string;
  size?: string;
}

export interface EventoMetadata {
  nome: string;
  data: string;
  status: "aberto" | "privado" | "encerrado";
  reconhecimento_facial: boolean;
  download_liberado: boolean;
  acesso: "publico" | "privado" | "link";
  token_convidado?: string;
  total_fotos: number;
  descricao?: string;
}

// Busca todos os arquivos de uma pasta do Drive
export async function listarFotosPasta(
  folderId: string,
  accessToken: string
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and not name contains '_' and trashed = false`,
    fields: "files(id,name,mimeType,thumbnailLink,webContentLink,createdTime,size)",
    pageSize: "1000",
    orderBy: "createdTime desc",
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const data = await res.json();
  return data.files ?? [];
}

// Lê um arquivo JSON oculto da pasta (ex: _evento.json)
export async function lerArquivoOculto<T>(
  folderId: string,
  fileName: string,
  accessToken: string
): Promise<T | null> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id,name)",
  });

  const searchRes = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const searchData = await searchRes.json();
  if (!searchData.files?.length) return null;

  const fileId = searchData.files[0].id;
  const contentRes = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!contentRes.ok) return null;
  return contentRes.json() as Promise<T>;
}

// Salva/atualiza um arquivo JSON oculto na pasta
export async function salvarArquivoOculto(
  folderId: string,
  fileName: string,
  data: unknown,
  accessToken: string
): Promise<void> {
  // Verifica se já existe
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id)",
  });

  const searchRes = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();
  const existingId = searchData.files?.[0]?.id;

  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });

  if (existingId) {
    // Atualiza
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: content,
    });
  } else {
    // Cria novo (oculto = nome começa com _)
    const meta = JSON.stringify({ name: fileName, parents: [folderId] });
    const formData = new FormData();
    formData.append("metadata", new Blob([meta], { type: "application/json" }));
    formData.append("file", blob);

    await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  }
}

// Deleta (move pra lixeira) um arquivo oculto, se existir
export async function deletarArquivoOculto(
  folderId: string,
  fileName: string,
  accessToken: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id)",
  });
  const searchRes = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await searchRes.json();
  const id = data.files?.[0]?.id;
  if (!id) return false;
  // Move pra lixeira (recuperável). Use ?deletePermanent=true se quiser permanente.
  const delRes = await fetch(`${DRIVE_API}/files/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  return delRes.ok;
}

// Gera URL de thumbnail do Drive (serve pelo CDN do Google, bem rápido)
export function thumbnailUrl(fileId: string, width = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

// Gera URL de download direto
export function downloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
