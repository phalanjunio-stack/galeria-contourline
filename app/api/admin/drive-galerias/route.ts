import { NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import { lerEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID;

type DriveCheck = {
  ok: boolean;
  email: string | null;
  erro?: string;
};

async function explicarDrive(prefixo: string, res: Response) {
  const data = await res.json().catch(() => null);
  const detalhe = typeof data?.error?.message === "string" ? data.error.message : "";
  return detalhe ? `${prefixo}: ${res.status} - ${detalhe}` : `${prefixo}: ${res.status}`;
}

async function testarDrive(token: string | null): Promise<DriveCheck> {
  if (!token) return { ok: false, email: null, erro: "Token Google indisponivel" };

  try {
    const res = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, email: null, erro: await explicarDrive("Drive conta", res) };
    }

    const data = await res.json().catch(() => null);
    return {
      ok: true,
      email: typeof data?.user?.emailAddress === "string" ? data.user.emailAddress : null,
    };
  } catch (err) {
    return { ok: false, email: null, erro: err instanceof Error ? err.message : String(err) };
  }
}

async function lerEventos(token: string | null) {
  if (ROOT_FOLDER && token) {
    try {
      const eventosDrive = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
      if (Array.isArray(eventosDrive)) {
        return { fonte: "drive", eventos: eventosDrive };
      }
    } catch {
      // O cache local ainda permite diagnosticar as pastas ja cadastradas.
    }
  }

  return { fonte: "cache-local", eventos: lerEventosLocal() };
}

async function testarGaleria(evento: EventoItem, token: string) {
  if (!evento.folder_id) {
    return {
      eventoId: evento.id,
      nome: evento.nome,
      pastaId: "",
      totalFotos: evento.total_fotos ?? 0,
      status: "sem_pasta",
      pastaNome: null,
      motivo: "Evento sem pasta do Drive",
    };
  }

  const base = {
    eventoId: evento.id,
    nome: evento.nome,
    pastaId: evento.folder_id,
    totalFotos: evento.total_fotos ?? 0,
  };

  try {
    const metaRes = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(evento.folder_id)}?fields=id,name,mimeType&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      }
    );
    if (!metaRes.ok) {
      return {
        ...base,
        status: "erro",
        pastaNome: null,
        motivo: await explicarDrive("Drive pasta", metaRes),
      };
    }

    const meta = await metaRes.json().catch(() => null);
    const params = new URLSearchParams({
      q: `'${evento.folder_id}' in parents and trashed = false`,
      fields: "files(id)",
      pageSize: "1",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    const listRes = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!listRes.ok) {
      return {
        ...base,
        status: "erro",
        pastaNome: typeof meta?.name === "string" ? meta.name : null,
        motivo: await explicarDrive("Drive listar", listRes),
      };
    }

    return {
      ...base,
      status: "online",
      pastaNome: typeof meta?.name === "string" ? meta.name : null,
      motivo: "Pasta acessivel para listar arquivos",
    };
  } catch (err) {
    return {
      ...base,
      status: "erro",
      pastaNome: null,
      motivo: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const token = (await getAccessTokenFromEnv()) ?? session.accessToken ?? null;
  const [drive, catalogo] = await Promise.all([testarDrive(token), lerEventos(token)]);

  const galerias = !token || !drive.ok
    ? catalogo.eventos.map((evento) => ({
        eventoId: evento.id,
        nome: evento.nome,
        pastaId: evento.folder_id ?? "",
        totalFotos: evento.total_fotos ?? 0,
        status: evento.folder_id ? "erro" : "sem_pasta",
        pastaNome: null,
        motivo: evento.folder_id ? drive.erro ?? "Drive indisponivel" : "Evento sem pasta do Drive",
      }))
    : await Promise.all(catalogo.eventos.map((evento) => testarGaleria(evento, token)));

  return NextResponse.json({
    ok: drive.ok,
    drive,
    fonteCatalogo: catalogo.fonte,
    rootConfigurada: Boolean(ROOT_FOLDER),
    consultadoEm: new Date().toISOString(),
    galerias,
  });
}
