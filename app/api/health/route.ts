import { NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";
import { lerStatusFaceIndexDb } from "@/lib/face-index-db";

// GET /api/health — health-check público (sem login)
// Útil para EasyPanel, UptimeRobot, etc.
export async function GET() {
  const checks: Record<string, { ok: boolean; detalhe?: string }> = {};

  // Drive
  try {
    const token = await getAccessTokenFromEnv();
    if (!token) {
      checks.drive = { ok: false, detalhe: "Sem refresh_token" };
    } else {
      const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      checks.drive = r.ok ? { ok: true } : { ok: false, detalhe: `HTTP ${r.status}` };
    }
  } catch (err) {
    checks.drive = { ok: false, detalhe: String(err) };
  }

  // Pgvector
  try {
    const pg = await lerStatusFaceIndexDb();
    checks.pgvector = pg.ok ? { ok: true, detalhe: `${pg.eventosIndexados} eventos` } : { ok: false, detalhe: pg.erro };
  } catch (err) {
    checks.pgvector = { ok: false, detalhe: String(err) };
  }

  // Face server
  try {
    const url = process.env.FACE_SERVER_URL;
    if (!url) {
      checks.faceServer = { ok: false, detalhe: "FACE_SERVER_URL ausente" };
    } else {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      checks.faceServer = r.ok ? { ok: true } : { ok: false, detalhe: `HTTP ${r.status}` };
    }
  } catch (err) {
    checks.faceServer = { ok: false, detalhe: String(err) };
  }

  const ok = Object.values(checks).every(c => c.ok);
  return NextResponse.json({
    ok,
    timestamp: new Date().toISOString(),
    checks,
  }, { status: ok ? 200 : 503 });
}
