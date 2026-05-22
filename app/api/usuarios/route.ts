import { NextResponse, NextRequest } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import type { PerfilUsuario } from "@/app/api/perfil/route";
import fs from "fs";
import path from "path";

const ROOT_FOLDER  = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH  = path.join(process.cwd(), "data", "perfis.json");
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

async function lerTodos(): Promise<PerfilUsuario[]> {
  // 1. Filesystem local (primário)
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch { /* continua */ }

  // 2. Drive como fallback
  const token = (await getAccessTokenFromEnv()) ?? (await auth())?.accessToken as string | undefined;
  if (token && ROOT_FOLDER) {
    try {
      const data = await lerArquivoOculto<PerfilUsuario[]>(ROOT_FOLDER, "_perfis.json", token);
      if (Array.isArray(data)) return data;
    } catch { /* continua */ }
  }
  return [];
}

function salvarLocal(perfis: PerfilUsuario[]) {
  try {
    const dir = path.dirname(PERFIS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERFIS_PATH, JSON.stringify(perfis, null, 2), "utf-8");
  } catch { /**/ }
}

/**
 * GET /api/usuarios — lista todos os perfis (admin)
 */
export async function GET() {
  const perfis = await lerTodos();

  const resultado = perfis.map(
    ({ email, nome, foto, foto_rastreio, descriptor, descriptors, notificar_site, criado_em, atualizado_em }) => ({
      email, nome, foto,
      thumb: foto_rastreio ?? null,
      temDescriptor:
        (Array.isArray(descriptors) && descriptors.length > 0) ||
        (Array.isArray(descriptor) && descriptor.length > 0),
      isAdmin: ADMIN_EMAILS.includes(email?.toLowerCase() ?? ""),
      notificar_site,
      criado_em,
      atualizado_em,
    })
  );

  resultado.sort((a, b) => b.criado_em?.localeCompare(a.criado_em ?? "") ?? 0);
  return NextResponse.json(resultado);
}

/**
 * DELETE /api/usuarios?email=xxx — remove perfil (admin)
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });

  const perfis  = await lerTodos();
  const filtrado = perfis.filter((p) => p.email !== email);

  // Salva no filesystem
  salvarLocal(filtrado);

  // Tenta salvar no Drive também
  const token = (await getAccessTokenFromEnv()) ?? session.accessToken as string | undefined;
  if (token && ROOT_FOLDER) {
    salvarArquivoOculto(ROOT_FOLDER, "_perfis.json", filtrado, token).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
