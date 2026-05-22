import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerStatusFaceIndexDb } from "@/lib/face-index-db";
import { lerArquivoOculto } from "@/lib/drive";
import type { PerfilUsuario } from "@/app/api/perfil/route";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

type FaceServerStatus = {
  configured: boolean;
  online: boolean;
  authOk: boolean;
  uptime: number | null;
  erro?: string;
};

type AutoIndexStatus = {
  supported: boolean;
  enabled: boolean | null;
  intervalMin: number | null;
  catalogoRemoto: boolean | null;
  iniciadoEm: string | null;
  rodando: boolean;
  ultimoCiclo: unknown;
  erro?: string;
};

async function testarFaceServer(): Promise<FaceServerStatus> {
  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  if (!serverUrl) {
    return { configured: false, online: false, authOk: false, uptime: null };
  }

  try {
    const healthRes = await fetch(`${serverUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!healthRes.ok) {
      return {
        configured: true,
        online: false,
        authOk: false,
        uptime: null,
        erro: `Health HTTP ${healthRes.status}`,
      };
    }

    const health = await healthRes.json().catch(() => null);
    const authRes = await fetch(`${serverUrl}/status/__motor_ia_check__`, {
      headers: serverSecret ? { "X-Server-Secret": serverSecret } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return {
      configured: true,
      online: true,
      authOk: authRes.status === 404,
      uptime: Number.isFinite(Number(health?.uptime)) ? Number(health.uptime) : null,
      ...(authRes.status === 401 ? { erro: "FACE_SERVER_SECRET nao confere com o servidor" } : {}),
    };
  } catch (err) {
    return {
      configured: true,
      online: false,
      authOk: false,
      uptime: null,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

async function lerAutoIndexacao(): Promise<AutoIndexStatus> {
  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  const indisponivel = (erro: string): AutoIndexStatus => ({
    supported: false,
    enabled: null,
    intervalMin: null,
    catalogoRemoto: null,
    iniciadoEm: null,
    rodando: false,
    ultimoCiclo: null,
    erro,
  });

  if (!serverUrl) return indisponivel("FACE_SERVER_URL ausente");

  try {
    const res = await fetch(`${serverUrl}/auto/status`, {
      headers: serverSecret ? { "X-Server-Secret": serverSecret } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return indisponivel("Atualize o face server para ler autoindexacao");
    if (!res.ok) return indisponivel(`Autoindex HTTP ${res.status}`);

    const status = await res.json().catch(() => null);
    return {
      supported: true,
      enabled: typeof status?.enabled === "boolean" ? status.enabled : null,
      intervalMin: Number.isFinite(Number(status?.intervalMin)) ? Number(status.intervalMin) : null,
      catalogoRemoto: typeof status?.catalogoRemoto === "boolean" ? status.catalogoRemoto : null,
      iniciadoEm: typeof status?.iniciadoEm === "string" ? status.iniciadoEm : null,
      rodando: Boolean(status?.rodando),
      ultimoCiclo: status?.ultimoCiclo ?? null,
    };
  } catch (err) {
    return indisponivel(err instanceof Error ? err.message : String(err));
  }
}

async function testarDrive() {
  const token = await getAccessTokenFromEnv();
  if (!process.env.DRIVE_ROOT_FOLDER_ID) {
    return { configured: false, ok: false, email: null, erro: "DRIVE_ROOT_FOLDER_ID ausente" };
  }
  if (!token) {
    return { configured: true, ok: false, email: null, erro: "Token Google indisponivel" };
  }

  try {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { configured: true, ok: false, email: null, erro: `Drive HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      configured: true,
      ok: true,
      email: typeof data?.user?.emailAddress === "string" ? data.user.emailAddress : null,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      email: null,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

function contarPerfis(perfis: PerfilUsuario[]) {
  return {
    total: perfis.length,
    comRosto: perfis.filter((perfil) => {
      if (Array.isArray(perfil.descriptors) && perfil.descriptors.length > 0) return true;
      return Array.isArray(perfil.descriptor) && perfil.descriptor.length === 128;
    }).length,
  };
}

async function lerPerfis() {
  try {
    const raw = await fs.readFile(PERFIS_PATH, "utf-8");
    const perfis = JSON.parse(raw) as PerfilUsuario[];
    if (Array.isArray(perfis) && perfis.length > 0) return contarPerfis(perfis);
  } catch { /* tenta Drive */ }

  const token = await getAccessTokenFromEnv();
  if (token && ROOT) {
    try {
      const perfis = await lerArquivoOculto<PerfilUsuario[]>(ROOT, "_perfis.json", token);
      if (Array.isArray(perfis)) return contarPerfis(perfis);
    } catch { /* retorna vazio */ }
  }
  return { total: 0, comRosto: 0 };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [faceServer, autoIndex, pgvector, drive, perfis] = await Promise.all([
    testarFaceServer(),
    lerAutoIndexacao(),
    lerStatusFaceIndexDb(),
    testarDrive(),
    lerPerfis(),
  ]);

  const notificacoes = {
    siteUrlConfigurada: Boolean(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL),
    secretConfigurado: Boolean(process.env.FACE_SERVER_SECRET),
  };

  return NextResponse.json({
    ok:
      faceServer.online &&
      faceServer.authOk &&
      pgvector.ok &&
      drive.ok &&
      notificacoes.siteUrlConfigurada &&
      notificacoes.secretConfigurado,
    faceServer,
    autoIndex,
    pgvector,
    drive,
    perfis,
    notificacoes,
  });
}
