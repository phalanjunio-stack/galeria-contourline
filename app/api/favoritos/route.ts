import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

interface PerfilUsuario {
  email: string;
  nome: string;
  favoritos?: string[];
  [key: string]: unknown;
}

function lerPerfis(): PerfilUsuario[] {
  try {
    if (fs.existsSync(PERFIS_PATH)) {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch { /**/ }
  return [];
}

function salvarPerfis(perfis: PerfilUsuario[]) {
  try {
    const dir = path.dirname(PERFIS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERFIS_PATH, JSON.stringify(perfis, null, 2), "utf-8");
  } catch { /**/ }
}

function resolverEmail(session: Awaited<ReturnType<typeof auth>>, body?: Record<string, unknown>): string | null {
  if (session?.user?.email) return session.user.email;
  if (body?.email && typeof body.email === "string") return body.email;
  return null;
}

/** GET /api/favoritos?email=xxx → retorna lista de IDs favoritos */
export async function GET(req: NextRequest) {
  const session = await auth();
  const emailQuery = req.nextUrl.searchParams.get("email");
  const email = session?.user?.email ?? emailQuery;
  if (!email) return NextResponse.json([]);

  const perfis = lerPerfis();
  const perfil = perfis.find(p => p.email === email);
  return NextResponse.json(perfil?.favoritos ?? []);
}

/** POST /api/favoritos → { email, favoritos: string[] } — salva lista completa */
export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json() as Record<string, unknown>;
  const email = resolverEmail(session, body);
  if (!email) return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });

  const favoritos = Array.isArray(body.favoritos) ? body.favoritos as string[] : [];

  const perfis = lerPerfis();
  const idx = perfis.findIndex(p => p.email === email);

  if (idx >= 0) {
    perfis[idx] = { ...perfis[idx], favoritos };
  } else {
    // Cria perfil mínimo se não existir
    perfis.push({
      email,
      nome: (body.nome as string) ?? email,
      favoritos,
    });
  }

  salvarPerfis(perfis);
  return NextResponse.json({ ok: true, total: favoritos.length });
}
