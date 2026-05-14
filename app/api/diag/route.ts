// ENDPOINT DE DIAGNÓSTICO TEMPORÁRIO — remover após resolver o problema
import { NextResponse } from "next/server";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID ?? "(não definido)";
const REFRESH = process.env.GOOGLE_REFRESH_TOKEN ?? "";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

async function obterToken(): Promise<{ ok: boolean; token?: string; erro?: string }> {
  if (!REFRESH) return { ok: false, erro: "GOOGLE_REFRESH_TOKEN não definido" };
  if (!CLIENT_ID) return { ok: false, erro: "GOOGLE_CLIENT_ID não definido" };
  if (!CLIENT_SECRET) return { ok: false, erro: "GOOGLE_CLIENT_SECRET não definido" };

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: REFRESH,
      }),
    });
    const data = await res.json();
    if (data.access_token) return { ok: true, token: data.access_token };
    return { ok: false, erro: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

async function testarDrive(token: string): Promise<{ ok: boolean; arquivos?: unknown[]; erro?: string }> {
  try {
    const params = new URLSearchParams({
      q: `'${ROOT}' in parents and name = '_index.json' and trashed = false`,
      fields: "files(id,name,size)",
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}: ${JSON.stringify(data)}` };
    return { ok: true, arquivos: data.files };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

async function lerIndexJson(token: string, fileId: string): Promise<{ ok: boolean; conteudo?: unknown; erro?: string }> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, conteudo: data };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

export async function GET() {
  const resultado: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DRIVE_ROOT_FOLDER_ID: ROOT,
      GOOGLE_REFRESH_TOKEN: REFRESH ? `${REFRESH.slice(0, 20)}...` : "(vazio)",
      GOOGLE_CLIENT_ID: CLIENT_ID ? `${CLIENT_ID.slice(0, 20)}...` : "(vazio)",
      GOOGLE_CLIENT_SECRET: CLIENT_SECRET ? `${CLIENT_SECRET.slice(0, 8)}...` : "(vazio)",
    },
  };

  // Testa token
  const tokenResult = await obterToken();
  resultado.token = { ok: tokenResult.ok, erro: tokenResult.erro };

  if (tokenResult.ok && tokenResult.token) {
    // Testa Drive
    const driveResult = await testarDrive(tokenResult.token);
    resultado.drive = { ok: driveResult.ok, arquivos: driveResult.arquivos, erro: driveResult.erro };

    // Lê _index.json se encontrou
    const arquivos = driveResult.arquivos as Array<{ id: string; name: string }> | undefined;
    if (arquivos && arquivos.length > 0) {
      const lerResult = await lerIndexJson(tokenResult.token, arquivos[0].id);
      resultado.indexJson = { ok: lerResult.ok, erro: lerResult.erro, eventos: Array.isArray(lerResult.conteudo) ? (lerResult.conteudo as unknown[]).length : lerResult.conteudo };
    }
  }

  return NextResponse.json(resultado, { status: 200 });
}
