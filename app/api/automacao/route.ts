import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const AUTOMACAO_PATH = path.join(process.cwd(), "data", "automacao.json");

export interface AutomacaoConfig {
  enabled: boolean;
  hora: string;           // "HH:MM"
  eventos: "todos" | string[]; // "todos" ou lista de eventoIds
  ultimaExecucao: string | null;
  ultimoLog: string | null;
}

const DEFAULT: AutomacaoConfig = {
  enabled: false,
  hora: "03:00",
  eventos: "todos",
  ultimaExecucao: null,
  ultimoLog: null,
};

function lerConfig(): AutomacaoConfig {
  try {
    if (fs.existsSync(AUTOMACAO_PATH)) {
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(AUTOMACAO_PATH, "utf-8")) };
    }
  } catch { /* ignora */ }
  return { ...DEFAULT };
}

function salvarConfig(config: AutomacaoConfig) {
  fs.writeFileSync(AUTOMACAO_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** GET /api/automacao — retorna config atual */
export async function GET() {
  return NextResponse.json(lerConfig());
}

/** POST /api/automacao — atualiza config (admin only) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const atual = lerConfig();
  const nova: AutomacaoConfig = {
    ...atual,
    ...(body.enabled   !== undefined && { enabled: Boolean(body.enabled) }),
    ...(body.hora      !== undefined && { hora: String(body.hora) }),
    ...(body.eventos   !== undefined && { eventos: body.eventos }),
    ...(body.ultimaExecucao !== undefined && { ultimaExecucao: body.ultimaExecucao }),
    ...(body.ultimoLog      !== undefined && { ultimoLog: body.ultimoLog }),
  };
  salvarConfig(nova);
  return NextResponse.json({ ok: true, config: nova });
}
