import { NextResponse } from "next/server";
import { auth, getAccessTokenFromEnv } from "@/auth";

/**
 * GET /api/admin/drive-status
 * Diagnóstico: o token de acesso ao Drive (usado pra escrever notificações,
 * matches, _mf_{email}.json etc.) está válido? Se não, admin precisa relogar
 * via Google para renovar o refresh_token em disco.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const token = await getAccessTokenFromEnv();
  if (!token) {
    return NextResponse.json({
      ok: false,
      motivo: "Sem refresh_token válido. Faça login via Google com a conta admin para renovar.",
    });
  }

  // Faz uma chamada barata ao Drive pra confirmar que o token funciona
  try {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        motivo: `Drive devolveu HTTP ${res.status}. Token pode estar revogado.`,
      });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, email: data?.user?.emailAddress });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      motivo: `Erro de rede ao testar Drive: ${String(e)}`,
    });
  }
}
