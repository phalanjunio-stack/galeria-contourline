import { ImageResponse } from "next/og";
import { lerEventosLocal } from "@/lib/eventos-cache";

export const runtime = "nodejs";
export const alt = "Galeria do evento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://galeria.iacontourline.com";

export default async function Image({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const eventos = lerEventosLocal();
  const ev = eventos.find(e => e.id === slug || slug.startsWith(`${e.id}-`));
  const nome = ev?.nome ?? "Evento";
  const data = ev?.data
    ? new Date(ev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const totalFotos = ev?.total_fotos ?? 0;
  const capaUrl = ev?.capa_id ? `${SITE_URL}/api/thumb?id=${ev.capa_id}&sz=1200` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #0D2B4E 0%, #2E7DD1 50%, #7a3cff 100%)",
          color: "white", padding: 80, position: "relative",
        }}
      >
        {capaUrl && (
          <img
            src={capaUrl}
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.35,
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(13,43,78,0.85), rgba(46,125,209,0.7))" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, #5BA4E5, #7a3cff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900,
            }}>C</div>
            <div style={{ fontSize: 24, fontWeight: 800, opacity: 0.85, letterSpacing: 1 }}>
              GALERIA CONTOURLINE
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{nome}</div>
            <div style={{ display: "flex", gap: 32, fontSize: 28, opacity: 0.9 }}>
              {data && <span>📅 {data}</span>}
              {totalFotos > 0 && <span>📸 {totalFotos.toLocaleString("pt-BR")} fotos</span>}
              <span>✨ Reconhecimento facial com IA</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
