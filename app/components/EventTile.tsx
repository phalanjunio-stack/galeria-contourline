"use client";

import Link from "next/link";
import { Camera, Layers, MapPin, ScanFace, Users } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import EventCardActions from "@/app/components/EventCardActions";
import EventCardMetrics from "@/app/components/EventCardMetrics";

// Datas "YYYY-MM-DD" sem hora viram UTC meia-noite (dia anterior no Brasil) — força meio-dia.
function parseData(iso: string) {
  return new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
}

function fmtDia(iso: string) {
  try { return parseData(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); }
  catch { return iso; }
}

export function fmtPeriodo(inicio: string, fim?: string) {
  if (!inicio) return "";
  try {
    const a = parseData(inicio);
    const ano = a.getFullYear();
    if (!fim || fim.slice(0, 10) === inicio.slice(0, 10)) {
      return a.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
    }
    const b = parseData(fim);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      const mes = a.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      return `${String(a.getDate()).padStart(2, "0")}–${String(b.getDate()).padStart(2, "0")} ${mes} ${ano}`;
    }
    return `${fmtDia(inicio)} – ${fmtDia(fim)} ${b.getFullYear()}`;
  } catch {
    return inicio;
  }
}

interface Props {
  evento: EventoItem;
  slug: string;
  encontrado?: boolean;
}

/** Card único pra eventos de um dia e de vários dias. Usa só os dados da API
 *  (nenhuma chamada extra ao Drive por card). */
export default function EventTile({ evento, slug, encontrado }: Props) {
  const dias = evento.dias ?? [];
  const multiDia = dias.length > 1;
  const href = `/eventos/${slug}${encontrado ? "?filtro=minhas" : ""}`;

  // Mosaico quando os dias têm capas próprias (modo automático); senão capa única.
  const capasDias = Array.from(new Set(dias.map((d) => d.capa_id).filter(Boolean) as string[]));
  const mosaico = multiDia && capasDias.length >= 2
    ? Array.from(new Set([evento.capa_id, ...capasDias].filter(Boolean) as string[])).slice(0, 3)
    : [];

  const fotos   = evento.total_fotos ?? 0;
  const pessoas = evento.pessoas_encontradas ?? 0;
  const periodo = fmtPeriodo(evento.data, multiDia ? evento.data_fim ?? dias[dias.length - 1]?.data : undefined);

  return (
    <article className="event-tile group flex flex-col overflow-hidden rounded-2xl">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-[color-mix(in_srgb,var(--accent)_8%,var(--card-bg))]">
        {mosaico.length >= 2 ? (
          <div className={`absolute inset-0 grid gap-0.5 ${mosaico.length === 3 ? "grid-cols-[1.4fr_1fr] grid-rows-2" : "grid-cols-2"}`}>
            {mosaico.map((id, i) => (
              <div key={id} className={`relative overflow-hidden ${mosaico.length === 3 && i === 0 ? "row-span-2" : ""}`}>
                <img src={`/api/thumb?id=${id}&sz=600`} alt="" loading="lazy"
                  className="event-tile-img absolute inset-0 h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : evento.capa_id ? (
          <img
            src={`/api/thumb?id=${evento.capa_id}&sz=600`}
            alt={evento.nome}
            loading="lazy"
            style={{ objectPosition: evento.capa_position ?? "center" }}
            className="event-tile-img absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[var(--accent)] opacity-40">
            <Camera size={38} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {multiDia && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0B1F3A] shadow-sm">
              <Layers size={12} /> {dias.length} dias
            </span>
          )}
          {encontrado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2E7DD1] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              <ScanFace size={12} /> Você está aqui
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <EventCardMetrics slug={slug} compact />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
          <span className="shrink-0">{periodo}</span>
          {evento.local && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <span className="inline-flex min-w-0 items-center gap-1 truncate capitalize">
                <MapPin size={11} className="shrink-0" /> {evento.local.toLowerCase()}
              </span>
            </>
          )}
        </p>

        <h3 className="font-display line-clamp-2 text-lg font-bold leading-snug text-[var(--ink)]">
          <Link href={href} className="hover:text-[var(--accent)] transition-colors">{evento.nome}</Link>
        </h3>

        {multiDia && (
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-0.5">
            {dias.map((dia, i) => (
              <Link key={dia.id} href={`/eventos/${slug}?dia=${dia.id}`}
                className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11px] leading-tight text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
                <span className="font-semibold text-[var(--ink)]">Dia {i + 1}</span> · {fmtDia(dia.data)}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap text-xs text-[var(--ink-soft)]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Camera size={13} /> {fotos.toLocaleString("pt-BR")} fotos
            </span>
            {pessoas > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} /> {pessoas.toLocaleString("pt-BR")} pessoas
              </span>
            )}
          </div>
          <EventCardActions slug={slug} nome={evento.nome} />
        </div>
      </div>
    </article>
  );
}
