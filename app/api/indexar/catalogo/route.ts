import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import { lerEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";
import type { PerfilUsuario } from "@/app/api/perfil/route";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

function authorized(req: NextRequest) {
  const secret = process.env.FACE_SERVER_SECRET;
  return !!secret && req.headers.get("x-server-secret") === secret;
}

async function lerEventos(): Promise<EventoItem[]> {
  const token = await getAccessTokenFromEnv();
  if (token && ROOT) {
    try {
      const eventos = await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token);
      if (Array.isArray(eventos)) return eventos;
    } catch { /* usa cache local */ }
  }
  return lerEventosLocal();
}

async function lerPerfis(): Promise<PerfilUsuario[]> {
  try {
    const raw = await fs.readFile(PERFIS_PATH, "utf-8");
    const perfis = JSON.parse(raw);
    if (Array.isArray(perfis)) return perfis;
  } catch { /* tenta Drive */ }

  const token = await getAccessTokenFromEnv();
  if (token && ROOT) {
    try {
      const perfis = await lerArquivoOculto<PerfilUsuario[]>(ROOT, "_perfis.json", token);
      if (Array.isArray(perfis)) return perfis;
    } catch { /* retorna vazio */ }
  }
  return [];
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const [eventos, perfis] = await Promise.all([lerEventos(), lerPerfis()]);
  const perfisComDesc = perfis
    .filter((p) => {
      const descs = p.descriptors?.length
        ? p.descriptors
        : p.descriptor?.length === 128
        ? [p.descriptor]
        : [];
      return descs.length > 0;
    })
    .map((p) => ({
      email: p.email,
      nome: p.nome,
      descriptors: p.descriptors?.length ? p.descriptors : [p.descriptor],
      thumb: p.foto_rastreio || null,
    }));

  return NextResponse.json({
    eventos: eventos
      .filter((e) => e.status !== "encerrado")
      .map((e) => {
        const folderIds = [...new Set([
          e.folder_id,
          ...(e.dias ?? []).map((dia) => dia.folder_id),
        ].filter(Boolean))] as string[];
        if (!folderIds.length) return null;
        return {
          ...e,
          folder_id: e.folder_id || folderIds[0],
          folder_ids: folderIds,
        };
      })
      .filter(Boolean),
    perfis: perfisComDesc,
  });
}
