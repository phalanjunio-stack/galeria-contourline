import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";
import { salvarArquivoOculto } from "@/lib/drive";
import { notificarUsuario } from "@/lib/notificacao";
import type { ResultadoIndexacao } from "@/app/api/matches/route";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID!;

function authorized(req: NextRequest) {
  const secret = process.env.FACE_SERVER_SECRET;
  return !!secret && req.headers.get("x-server-secret") === secret;
}

type MatchRecebido = {
  email?: string;
  nome?: string;
  fotosIds?: string[];
  thumbUrl?: string | null;
};

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const eventoId = typeof body?.eventoId === "string" ? body.eventoId : "";
  const eventoNome = typeof body?.eventoNome === "string" ? body.eventoNome : "";
  const totalFotos = Number(body?.totalFotos) || 0;
  const fotosComRosto = Number(body?.fotosComRosto) || 0;
  const usuarios = Array.isArray(body?.usuarios)
    ? body.usuarios
        .filter((u: MatchRecebido) => typeof u?.email === "string" && Array.isArray(u?.fotosIds))
        .map((u: MatchRecebido) => ({
          email: u.email!.trim().toLowerCase(),
          nome: typeof u.nome === "string" ? u.nome : u.email!,
          fotosIds: u.fotosIds!.filter((id): id is string => typeof id === "string"),
          thumbUrl: typeof u.thumbUrl === "string" ? u.thumbUrl : undefined,
        }))
        .filter((u) => u.email && u.fotosIds.length > 0)
    : [];

  if (!eventoId || !eventoNome) {
    return NextResponse.json({ error: "eventoId e eventoNome obrigatorios" }, { status: 400 });
  }

  const resultado: ResultadoIndexacao = {
    eventoId,
    eventoNome,
    processadoEm: new Date().toISOString(),
    totalFotos,
    fotosComRosto,
    usuarios,
  };

  const token = await getAccessTokenFromEnv();
  if (token && ROOT) {
    await salvarArquivoOculto(ROOT, `_matches_${eventoId}.json`, resultado, token)
      .catch((err) => console.warn("[indexar/notificar] Falha ao salvar matches:", err));
  }

  const notificados = [];
  for (const usuario of usuarios) {
    const thumbUrl = usuario.thumbUrl ?? `/api/thumb?id=${usuario.fotosIds[0]}&sz=120`;
    const resultadoNotif = await notificarUsuario({
      email: usuario.email,
      nomeEvento: eventoNome,
      eventoSlug: eventoId,
      thumbUrl,
      notifSite: true,
    });
    notificados.push({ email: usuario.email, resultado: resultadoNotif });
  }

  return NextResponse.json({
    ok: true,
    matches: usuarios.length,
    notificacoes: notificados.filter((n) => n.resultado.some((r) => r.ok)).length,
    notificados,
  });
}
