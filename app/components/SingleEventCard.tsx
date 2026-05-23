"use client";

import Link from "next/link";
import { Calendar, Camera, MapPin, MoreVertical, ScanFace, Users } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import EventCardActions from "@/app/components/EventCardActions";
import EventCardMetrics from "@/app/components/EventCardMetrics";

const statusConfig: Record<string, { className: string; label: string }> = {
  aberto: {
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200",
    label: "Disponivel",
  },
  privado: {
    className: "bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200",
    label: "Privado",
  },
  encerrado: {
    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/70",
    label: "Encerrado",
  },
};

interface Props {
  evento: EventoItem;
  slug: string;
  encontrado?: boolean;
}

function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function SingleEventCard({ evento, slug, encontrado }: Props) {
  const st = statusConfig[evento.status] ?? statusConfig.encerrado;
  const href = `/eventos/${slug}${encontrado ? "?filtro=minhas" : ""}`;

  return (
    <article className="overflow-hidden rounded-xl border border-[#DCE7F5] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/12 dark:bg-[#102A44]">
      <Link href={href} className="group relative block aspect-[16/10] overflow-hidden bg-[#EFF5FF] dark:bg-white/5">
        {evento.capa_id ? (
          <img
            src={`/api/thumb?id=${evento.capa_id}&sz=600`}
            alt={evento.nome}
            style={{ objectPosition: evento.capa_position ?? "center" }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[#2E7DD1]/45">
            <Camera size={38} />
          </div>
        )}
        {encontrado && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/92 px-2 py-1 text-[10px] font-medium text-[#1A4A80] shadow-sm">
            <ScanFace size={10} /> Voce esta aqui
          </span>
        )}
        <div className="absolute bottom-2 right-2">
          <EventCardMetrics slug={slug} compact />
        </div>
      </Link>

      <div className="p-3.5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#071C3A] dark:text-white">
            {evento.nome}
          </h3>
          <button
            type="button"
            aria-label="Mais opcoes"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#6D7F98] transition hover:bg-[#EFF6FF] hover:text-[#2E7DD1] dark:text-white/60 dark:hover:bg-white/10"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="space-y-1.5 text-[11px] font-normal text-[#5F708A] dark:text-white/65">
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-[#5F708A] dark:text-white/55" />
            <span>{fmtData(evento.data)}</span>
          </div>
          {evento.local && (
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-[#5F708A] dark:text-white/55" />
              <span className="line-clamp-1">{evento.local}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Camera size={12} className="text-[#5F708A] dark:text-white/55" />
            <span>{evento.total_fotos.toLocaleString("pt-BR")} fotos</span>
            <Users size={12} className="ml-2 text-[#5F708A] dark:text-white/55" />
            <span>{Math.max(0, Math.round((evento.total_fotos ?? 0) * 0.18)).toLocaleString("pt-BR")} pessoas</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${st.className}`}>
            {st.label}
          </span>
          <EventCardActions slug={slug} nome={evento.nome} />
        </div>

        <Link
          href={href}
          className="mt-3 flex h-9 items-center justify-center rounded-md border border-[#DCE7F5] text-xs font-medium text-[#0D2B4E] transition hover:border-[#2E7DD1] hover:bg-[#F4F9FF] dark:border-white/15 dark:text-white dark:hover:bg-white/10"
        >
          Ver evento
        </Link>
      </div>
    </article>
  );
}
