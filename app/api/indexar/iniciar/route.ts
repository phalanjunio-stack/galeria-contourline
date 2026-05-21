// POST /api/indexar/iniciar
// Versão PÚBLICA — qualquer usuário pode disparar indexação de um evento.
// Anti-spam: cooldown por eventoId (1 indexação ativa por evento; cooldown de 60s entre tentativas).
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type { PerfilUsuario } from "@/app/api/perfil/route";

const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

// Cooldown em memória (perdido em restart, suficiente pra anti-abuse leve)
const COOLDOWN_MS = 60_000;
const ultimaTentativa = new Map<string, number>();

async function lerTodosPerfis(): Promise<PerfilUsuario[]> {
  try {
    const raw = await fs.readFile(PERFIS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  if (!serverUrl) {
    return NextResponse.json(
      { error: "FACE_SERVER_URL nao configurado" },
      { status: 500 }
    );
  }

  const { eventoId, eventoNome, folderId } = await req.json();
  if (!eventoId || !folderId) {
    return NextResponse.json({ error: "Faltam eventoId/folderId" }, { status: 400 });
  }

  // Cooldown por evento
  const now = Date.now();
  const last = ultimaTentativa.get(eventoId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const restante = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: `Aguarde ${restante}s antes de tentar novamente`, cooldown: restante },
      { status: 429 }
    );
  }
  ultimaTentativa.set(eventoId, now);

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

  try {
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
        { error: `Servidor: ${res.status} ${txt}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      jobId: data.jobId,
      status: data.status,
      perfisEnviados: perfisComDesc.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
