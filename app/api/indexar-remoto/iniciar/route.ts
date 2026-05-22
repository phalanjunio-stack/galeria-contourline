// POST /api/indexar-remoto/iniciar
// Dispara indexacao no face server (background).
// Responde imediato com jobId — admin pode fechar a aba.
import { NextRequest, NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto } from "@/lib/drive";
import fs from "node:fs/promises";
import path from "node:path";
import type { PerfilUsuario } from "@/app/api/perfil/route";
import { registrarAtividade } from "@/lib/atividade";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;
const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

async function lerTodosPerfis(): Promise<PerfilUsuario[]> {
  try {
    const raw = await fs.readFile(PERFIS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    // tenta Drive
  }

  const token = await getAccessTokenFromEnv();
  if (token && ROOT) {
    try {
      const perfis = await lerArquivoOculto<PerfilUsuario[]>(ROOT, "_perfis.json", token);
      if (Array.isArray(perfis)) return perfis;
    } catch {
      // sem catalogo remoto
    }
  }
  return [];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  if (!serverUrl) {
    return NextResponse.json(
      { error: "FACE_SERVER_URL nao configurado no .env" },
      { status: 500 }
    );
  }

  const { eventoId, eventoNome, folderId } = await req.json();
  if (!eventoId || !folderId) {
    return NextResponse.json(
      { error: "Faltam eventoId/folderId" },
      { status: 400 }
    );
  }

  // Monta lista de perfis com descritores
  const perfis = await lerTodosPerfis();
  const perfisComDesc = perfis
    .filter((p) => {
      const descs = p.descriptors && p.descriptors.length > 0
        ? p.descriptors
        : p.descriptor && p.descriptor.length === 128
        ? [p.descriptor]
        : [];
      return descs.length > 0;
    })
    .map((p) => ({
      email: p.email,
      nome: p.nome,
      descriptors: p.descriptors && p.descriptors.length > 0
        ? p.descriptors
        : p.descriptor
        ? [p.descriptor]
        : [],
      thumb: p.foto_rastreio || null,
    }));

  // Chama o face server
  const res = await fetch(`${serverUrl}/indexar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serverSecret ? { "X-Server-Secret": serverSecret } : {}),
    },
    body: JSON.stringify({
      eventoId,
      eventoNome: eventoNome || eventoId,
      folderId,
      perfis: perfisComDesc,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json(
      { error: `Face server: ${res.status} ${txt}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  await registrarAtividade({
    tipo: "indexacao.iniciada",
    email: session.user.email ?? undefined,
    nome: session.user.name ?? undefined,
    detalhes: { evento: eventoNome || eventoId, eventoId, jobId: data.jobId, perfis: perfisComDesc.length },
  });
  return NextResponse.json({
    jobId: data.jobId,
    status: data.status,
    perfisEnviados: perfisComDesc.length,
  });
}
