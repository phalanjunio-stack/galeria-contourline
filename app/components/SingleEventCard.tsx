"use client";

import Link from "next/link";
import { Calendar, Camera, ScanFace } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import EventCardActions from "@/app/components/EventCardActions";

const statusConfig: Record<string, { bg: string; dot: string; label: string }> = {
  aberto: { bg: "from-[#2E7DD1] to-[#7a3cff]", dot: "bg-white", label: "Aberto" },
  privado: { bg: "from-amber-500 to-amber-400", dot: "bg-white", label: "Privado" },
  encerrado: { bg: "from-gray-500 to-gray-400", dot: "bg-gray-200", label: "Encerrado" },
};

interface Props {
  evento: EventoItem;
  slug: string;
  encontrado?: boolean;
}

export default function SingleEventCard({ evento, slug, encontrado }: Props) {
  const st = statusConfig[evento.status] ?? statusConfig.encerrado;
  const href = `/eventos/${slug}${encontrado ? "?filtro=minhas" : ""}`;

  return (
    <article className="group">
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}
      >
        <Link href={href} className="absolute inset-0 z-10" aria-label={`Abrir evento ${evento.nome}`} />

        {evento.capa_id ? (
          <img
            src={`/api/thumb?id=${evento.capa_id}&sz=600`}
            alt={evento.nome}
            style={{ objectPosition: evento.capa_position ?? "center" }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={42} className="text-white/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/90 via-[#0D2B4E]/20 to-transparent" />

        <div className={`absolute right-2.5 top-2.5 z-20 flex items-center gap-1 rounded-md bg-gradient-to-r ${st.bg} px-2 py-0.5 text-[10px] font-bold text-white shadow`}>
          <span className={`h-1.5 w-1.5 rounded-sm ${st.dot}`} />
          {st.label}
        </div>

        {encontrado && (
          <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#1A4A80] shadow">
            <ScanFace size={10} /> Voce esta aqui
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-tight text-white">{evento.nome}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-white/70">
              <Calendar size={10} />
              <span>{new Date(evento.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
            {evento.total_fotos > 0 && (
              <span className="text-[10px] font-semibold text-white/80">{evento.total_fotos} fotos</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end">
        <EventCardActions slug={slug} nome={evento.nome} />
      </div>
    </article>
  );
}
