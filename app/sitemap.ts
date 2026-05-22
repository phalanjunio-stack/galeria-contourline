import type { MetadataRoute } from "next";
import { lerEventosLocal } from "@/lib/eventos-cache";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://galeria.iacontourline.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const eventos = lerEventosLocal();
  const now = new Date();

  const rotasFixas: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/eventos`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/cadastrar-rosto`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/buscar-pessoa`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const rotasEventos: MetadataRoute.Sitemap = eventos
    .filter(e => e.status === "aberto")
    .map(e => ({
      url: `${SITE_URL}/eventos/${e.id}`,
      lastModified: e.criado_em ? new Date(e.criado_em) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...rotasFixas, ...rotasEventos];
}
