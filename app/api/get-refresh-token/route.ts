import { NextResponse } from "next/server";
import { auth } from "@/auth";

// GET /api/get-refresh-token — mostra o refresh_token da sessão atual
// Use uma vez para copiar no .env.local → GOOGLE_REFRESH_TOKEN
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // O refresh_token está no JWT mas não é exposto na session por padrão
  // Redireciona para instrução manual
  return NextResponse.json({
    instrucao: "Abra o arquivo .next/dev/logs/ ou relogar com Google e ver os logs do servidor",
    dica: "O GOOGLE_REFRESH_TOKEN aparece nos logs do servidor na primeira vez que você loga com Google (procure por 'refreshToken' no terminal)",
  });
}
