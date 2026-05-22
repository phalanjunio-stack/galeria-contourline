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

function descritoresValidos(perfil: PerfilUsuario) {
  const multiplos = Array.isArray(perfil.descriptors)
    ? perfil.descriptors.filter((descriptor) => Array.isArray(descriptor) && descriptor.length === 128)
    : [];
  if (multiplos.length > 0) return multiplos;
  return Array.isArray(perfil.descriptor) && perfil.descriptor.length === 128
    ? [perfil.descriptor]
    : [];
}

function fotosRastreio(perfil: PerfilUsuario) {
  const multiplas = Array.isArray(perfil.foto_rastreios)
    ? perfil.foto_rastreios.filter((foto): foto is string => typeof foto === "string" && foto.length > 0)
    : [];
  if (multiplas.length > 0) return multiplas.slice(0, 5);
  return typeof perfil.foto_rastreio === "string" && perfil.foto_rastreio.length > 0
    ? [perfil.foto_rastreio]
    : [];
}

function resumirPerfil(perfil: PerfilUsuario) {
  const referenciasRosto = fotosRastreio(perfil);
  const totalReferencias = descritoresValidos(perfil).length;
  return {
    email: perfil.email,
    nome: perfil.nome,
    foto: perfil.foto,
    thumb: perfil.foto_rastreio ?? referenciasRosto[0] ?? null,
    temDescriptor: totalReferencias > 0,
    totalReferencias,
    totalFotosRastreio: referenciasRosto.length,
    isAdmin: ADMIN_EMAILS.includes(perfil.email?.toLowerCase() ?? ""),
    notificar_site: perfil.notificar_site,
    criado_em: perfil.criado_em,
    atualizado_em: perfil.atualizado_em,
  };
}

/**
 * GET /api/usuarios — lista todos os perfis (admin)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const perfis = await lerTodos();
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (email) {
    const perfil = perfis.find((item) => item.email?.trim().toLowerCase() === email);
    if (!perfil) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({
      ...resumirPerfil(perfil),
      referenciasRosto: fotosRastreio(perfil),
    });
  }

  const resultado = perfis.map(resumirPerfil);

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
