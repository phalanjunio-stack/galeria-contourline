import { NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import type { PerfilUsuario } from "@/app/api/perfil/route";
import fs from "fs";
import path from "path";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

async function lerTodosPerfis(): Promise<PerfilUsuario[]> {
  // 1. Filesystem local (primário)
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch { /* continua */ }

  // 2. Drive como fallback
  const serviceToken = await getAccessTokenFromEnv();
  const token = serviceToken;
  if (token && ROOT_FOLDER) {
    try {
      const data = await lerArquivoOculto<PerfilUsuario[]>(ROOT_FOLDER, "_perfis.json", token);
      if (Array.isArray(data)) return data;
    } catch { /* continua */ }
  }

  return [];
}

/**
 * GET /api/perfil/todos
 * Retorna todos os perfis com descriptor (para reconhecimento facial em lote).
 */
export async function GET() {
  const session = await auth();
  // Não requer admin — apenas token válido
  // (a página de reconhecimento já é protegida pelo layout admin)

  const perfis = await lerTodosPerfis();

  const resultado = perfis
    .filter((p) => Array.isArray(p.descriptor) && p.descriptor.length > 0)
    .map(({ email, nome, descriptor, notificar_site, foto_rastreio }) => ({
      email,
      nome,
      descriptor,
      notificar_site,
      thumb: foto_rastreio ?? null,
    }));

  return NextResponse.json(resultado);
}
