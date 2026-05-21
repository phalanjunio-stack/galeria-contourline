import { NextRequest, NextResponse } from "next/server";
import { buscarClustersDb, faceIndexDbEnabled } from "@/lib/face-index-db";

export async function POST(req: NextRequest) {
  if (!faceIndexDbEnabled()) {
    return NextResponse.json({ enabled: false, matches: [] });
  }

  const body = await req.json();
  const eventoIds = Array.isArray(body?.eventoIds)
    ? body.eventoIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const descriptors = Array.isArray(body?.descriptors)
    ? body.descriptors.filter((d: unknown): d is number[] =>
        Array.isArray(d) && d.every((n) => typeof n === "number")
      )
    : [];

  if (eventoIds.length === 0 || descriptors.length === 0) {
    return NextResponse.json({ enabled: true, matches: [] });
  }

  try {
    const matches = await buscarClustersDb({
      eventoIds,
      descriptors,
      limit: 12,
      threshold: 0.65,
    });
    return NextResponse.json({ enabled: true, matches: matches ?? [] });
  } catch (err) {
    console.error("[pessoas/buscar] pgvector falhou:", err);
    return NextResponse.json({ enabled: false, matches: [] });
  }
}
