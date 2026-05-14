import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { notificarUsuario } from "@/lib/notificacao";

/**
 * POST /api/reconhecimento
 * Chamado pelo painel admin após detectar uma correspondência facial.
 * Envia email + notificação no sininho para o usuário encontrado.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const cronSecret = process.env.CRON_SECRET ?? "";
  const internalCall = cronSecret && req.headers.get("x-cron-secret") === cronSecret;

  if (!session?.user?.isAdmin && !internalCall) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { email, nomeEvento, eventoSlug, thumbUrl } = body as {
    email: string;
    nomeEvento: string;
    eventoSlug: string;
    thumbUrl?: string;
  };

  if (!email || !nomeEvento || !eventoSlug) {
    return NextResponse.json({ error: "Campos obrigatórios: email, nomeEvento, eventoSlug" }, { status: 400 });
  }

  try {
    const resultado = await notificarUsuario({
      email,
      nomeEvento,
      eventoSlug,
      thumbUrl,
      notifSite: true,
    });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error("[/api/reconhecimento] Erro ao notificar:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
