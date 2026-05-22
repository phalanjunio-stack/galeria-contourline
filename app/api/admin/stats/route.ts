import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { lerEventosLocal } from "@/lib/eventos-cache";
import { listarAtividades } from "@/lib/atividade";
import { lerStatusFaceIndexDb } from "@/lib/face-index-db";
import fs from "node:fs/promises";
import path from "node:path";

const PERFIS_PATH = path.join(process.cwd(), "data", "perfis.json");

async function lerPerfis() {
  try {
    const data = JSON.parse(await fs.readFile(PERFIS_PATH, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [eventos, perfis, atividades, faceIndex] = await Promise.all([
    Promise.resolve(lerEventosLocal()),
    lerPerfis(),
    listarAtividades({ limite: 1000 }),
    lerStatusFaceIndexDb(),
  ]);

  const totalFotos = eventos.reduce((sum, evento) => sum + (Number(evento.total_fotos) || 0), 0);
  const perfisComRosto = perfis.filter((perfil) =>
    (Array.isArray(perfil.descriptors) && perfil.descriptors.length > 0)
    || (Array.isArray(perfil.descriptor) && perfil.descriptor.length === 128)
  ).length;

  const downloads = atividades.filter((atividade) => atividade.tipo === "foto.baixada").length;
  const confirmadas = atividades.filter((atividade) => atividade.tipo === "foto.confirmada").length;

  return NextResponse.json({
    eventos: eventos.length,
    eventosAbertos: eventos.filter((evento) => evento.status === "aberto").length,
    totalFotos,
    usuarios: perfis.length,
    perfisComRosto,
    downloads,
    fotosConfirmadas: confirmadas,
    atividades: atividades.length,
    faceIndex,
  });
}
