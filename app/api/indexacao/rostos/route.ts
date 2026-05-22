import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { faceIndexDbEnabled, lerAmostraRostosIndexadosDb } from "@/lib/face-index-db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const eventoId = req.nextUrl.searchParams.get("eventoId");
  if (!eventoId) {
    return NextResponse.json({ error: "eventoId obrigatorio" }, { status: 400 });
  }
  if (!faceIndexDbEnabled()) {
    return NextResponse.json({ enabled: false, preview: null });
  }

  try {
    const preview = await lerAmostraRostosIndexadosDb(eventoId);
    return NextResponse.json({ enabled: true, preview });
  } catch (err) {
    console.error("[indexacao/rostos] Falha ao ler rostos indexados:", err);
    return NextResponse.json({ error: "Falha ao ler indice facial" }, { status: 500 });
  }
}
