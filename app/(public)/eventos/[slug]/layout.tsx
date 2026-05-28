import type { Metadata } from "next";
import type { EventoItem } from "@/app/api/eventos/route";
import { lerArquivoOculto } from "@/lib/drive";
import { lerEventosLocal } from "@/lib/eventos-cache";
import { getAccessTokenFromEnv } from "@/auth";

// Server-side: lê eventos direto do Drive (com fallback pro cache local).
// Evita ida-volta HTTP pra gerar metadata.
async function carregarEventos(): Promise<EventoItem[]> {
  const ROOT = process.env.DRIVE_ROOT_FOLDER_ID;
  if (ROOT) {
    try {
      const token = await getAccessTokenFromEnv();
      if (token) {
        const fromDrive = await lerArquivoOculto<EventoItem[]>(ROOT, "_index.json", token);
        if (Array.isArray(fromDrive) && fromDrive.length > 0) return fromDrive;
      }
    } catch { /* cai pro cache */ }
  }
  return lerEventosLocal();
}

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://galeria.iacontourline.com";
}

function fmtData(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const eventos = await carregarEventos();
  const ev = eventos.find((e) => e.id === slug || slug.startsWith(`${e.id}-`));

  const base = siteUrl();
  const eventUrl = `${base}/eventos/${slug}`;

  if (!ev) {
    return {
      title: "Evento — Galeria Contourline",
      description: "Encontre suas fotos nos eventos da Contourline.",
      openGraph: { url: eventUrl, siteName: "Galeria Contourline" },
    };
  }

  // Imagem: banner_id tem prioridade, depois capa_id, depois primeira capa de dia
  const imgId =
    ev.banner_id ??
    ev.capa_id ??
    ev.dias?.find((d) => d.capa_id)?.capa_id ??
    null;
  const imageUrl = imgId ? `${base}/api/thumb?id=${imgId}&sz=1200` : undefined;

  const periodo = ev.data_fim && ev.data_fim !== ev.data
    ? `${fmtData(ev.data)} a ${fmtData(ev.data_fim)}`
    : fmtData(ev.data);

  const local = ev.local ? ` · ${ev.local}` : "";
  const totalFotos = ev.total_fotos ? ` · ${ev.total_fotos.toLocaleString("pt-BR")} fotos` : "";
  const desc = `${periodo}${local}${totalFotos}. Encontre suas fotos com reconhecimento facial.`;

  return {
    title: ev.nome,
    description: desc,
    openGraph: {
      title: ev.nome,
      description: desc,
      url: eventUrl,
      siteName: "Galeria Contourline",
      locale: "pt_BR",
      type: "website",
      ...(imageUrl ? {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: ev.nome }],
      } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: ev.nome,
      description: desc,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default function EventoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
