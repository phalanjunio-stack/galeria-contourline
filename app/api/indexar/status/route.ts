// GET /api/indexar/status?jobId=xxx
// Versão PÚBLICA — proxy pro servidor de indexação.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Falta jobId" }, { status: 400 });
  }

  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  if (!serverUrl) {
    return NextResponse.json({ error: "FACE_SERVER_URL nao configurado" }, { status: 500 });
  }

  try {
    const res = await fetch(`${serverUrl}/status/${encodeURIComponent(jobId)}`, {
      headers: serverSecret ? { "X-Server-Secret": serverSecret } : {},
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `Servidor: ${res.status} ${txt}` },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
