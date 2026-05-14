import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * POST /api/automacao/executar
 * Proxy admin → cron. Permite que o painel admin dispare o cron
 * sem expor o CRON_SECRET no cliente.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const secret = process.env.CRON_SECRET ?? "";
  const base   = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const r = await fetch(`${base}/api/cron/processar`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
