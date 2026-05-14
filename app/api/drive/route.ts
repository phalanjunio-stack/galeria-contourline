import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listarFotosPasta, lerArquivoOculto, salvarArquivoOculto, EventoMetadata } from "@/lib/drive";

// GET /api/drive?folderId=xxx  → lista fotos + metadados do evento
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) return NextResponse.json({ error: "folderId obrigatório" }, { status: 400 });

  try {
    const [fotos, metadata] = await Promise.all([
      listarFotosPasta(folderId, session.accessToken),
      lerArquivoOculto<EventoMetadata>(folderId, "_evento.json", session.accessToken),
    ]);
    return NextResponse.json({ fotos, metadata });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/drive  → salva metadados do evento no Drive
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const { folderId, fileName, data } = await req.json();
    if (!folderId || !fileName) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }
    await salvarArquivoOculto(folderId, fileName, data, session.accessToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
