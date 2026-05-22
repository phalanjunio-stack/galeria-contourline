import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listarAtividades } from "@/lib/atividade";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const limite = Number(req.nextUrl.searchParams.get("limite") ?? 200);
  const tipo = req.nextUrl.searchParams.get("tipo");
  const atividades = await listarAtividades({ limite, tipo });
  return NextResponse.json({ atividades });
}
