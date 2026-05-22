// GET /api/indexar-remoto/status?jobId=xxx
// Proxy pro face server
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Falta jobId" }, { status: 400 });
  }

  const serverUrl = process.env.FACE_SERVER_URL;
  const serverSecret = process.env.FACE_SERVER_SECRET;
  if (!serverUrl) {
    return NextResponse.json({ error: "FACE_SERVER_URL nao configurado" }, { status: 500 });
  }

  const res = await fetch(`${serverUrl}/status/${encodeURIComponent(jobId)}`, {
    headers: serverSecret ? { "X-Server-Secret": serverSecret } : {},
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ error: `Face server: ${res.status} ${txt}` }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
