import { NextRequest, NextResponse } from "next/server";
import { buscarFotosPorRostoDb, faceIndexDbEnabled } from "@/lib/face-index-db";

const DEFAULT_THRESHOLD = 0.55;

function lerThreshold(value: unknown) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) return DEFAULT_THRESHOLD;
  return Math.min(0.65, Math.max(0.35, threshold));
}

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
    const matches = await buscarFotosPorRostoDb({
      eventoIds,
      descriptors,
      limit: 400,
      threshold: lerThreshold(body?.threshold),
    });
    return NextResponse.json({ enabled: true, matches: matches ?? [] });
  } catch (err) {
    console.error("[pessoas/buscar] pgvector falhou:", err);
    return NextResponse.json({ enabled: false, matches: [] });
  }
}
