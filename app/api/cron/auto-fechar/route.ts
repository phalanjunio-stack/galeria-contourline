import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromEnv } from "@/auth";
import { lerArquivoOculto, salvarArquivoOculto } from "@/lib/drive";
import { salvarEventosLocal } from "@/lib/eventos-cache";
import type { EventoItem } from "@/app/api/eventos/route";

const ROOT_FOLDER = process.env.DRIVE_ROOT_FOLDER_ID!;

// Quantos dias após data_fim o evento entra em "encerrado" automaticamente
const DIAS_PARA_ENCERRAR = 30;

// POST /api/cron/auto-fechar
// Marca eventos antigos como "encerrado" automaticamente
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAccessTokenFromEnv();
  if (!token) return NextResponse.json({ error: "Token Drive indisponível" }, { status: 503 });

  try {
    const eventos = await lerArquivoOculto<EventoItem[]>(ROOT_FOLDER, "_index.json", token);
    if (!Array.isArray(eventos)) return NextResponse.json({ error: "_index.json inválido" }, { status: 500 });

    const hoje = new Date();
    const limite = new Date(hoje.getTime() - DIAS_PARA_ENCERRAR * 86400000);
    let alterados = 0;

    const atualizados = eventos.map(e => {
      if (e.status !== "aberto") return e;
      const dataFim = e.data_fim ? new Date(e.data_fim) : new Date(e.data);
      if (Number.isNaN(dataFim.getTime())) return e;
      if (dataFim < limite) {
        alterados++;
        return { ...e, status: "encerrado" };
      }
      return e;
    });

    if (alterados > 0) {
      await salvarArquivoOculto(ROOT_FOLDER, "_index.json", atualizados, token);
      salvarEventosLocal(atualizados);
    }

    return NextResponse.json({
      ok: true,
      alterados,
      total: eventos.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = new Headers(req.headers);
  headers.set("authorization", `Bearer ${cronSecret}`);
  return POST(new NextRequest(req.url, { method: "POST", headers }));
}
