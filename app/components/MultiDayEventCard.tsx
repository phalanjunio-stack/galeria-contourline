"use client";
import Link from "next/link";
import { Calendar, MapPin, Camera, Layers, ChevronRight, ScanFace } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

function fmtData(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

interface Props {
  evento: EventoItem;
  slug: string;
}

export default function MultiDayEventCard({ evento, slug }: Props) {
  const dias = evento.dias ?? [];
  const totalDias = dias.length;
  const totalFotos = dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0) || evento.total_fotos;

  return (
    <article className="group relative bg-white dark:bg-[#0a1a2f]/80 border border-[#2E7DD1]/15 dark:border-[#5BA4E5]/15 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      {/* Capa clicável */}
      <Link href={`/eventos/${slug}`} className="block relative aspect-[4/3] bg-[#07182f] overflow-hidden">
        {evento.capa_id ? (
          <img src={`/api/thumb?id=${evento.capa_id}&sz=600`} alt={evento.nome}
            style={{ objectPosition: evento.capa_position ?? "center" }}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 p-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-md bg-gradient-to-br from-[#2E7DD1]/70 to-[#7a3cff]/50" />
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/72 to-transparent dark:from-[#0a1a2f] dark:via-[#0a1a2f]/72" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#2E7DD1]/18 via-[#7a3cff]/10 to-transparent" />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#2E7DD1] to-[#7a3cff] text-white text-[11px] font-bold shadow-md">
          <Layers size={11} /> {totalDias} dias
        </span>
      </Link>

      <div className="relative -mt-10 p-4 pt-0 space-y-3">
        <h3 className="font-bold text-[#0D2B4E] dark:text-white text-base leading-tight line-clamp-2">
          {evento.nome}
        </h3>

        <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} />
            <span>{fmtData(evento.data)}{evento.data_fim ? ` a ${fmtData(evento.data_fim)}` : ""}</span>
          </div>
          {evento.local && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} />
              <span className="line-clamp-1">{evento.local}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Camera size={12} />
            <span>{totalFotos.toLocaleString("pt-BR")} fotos</span>
          </div>
        </div>

        {/* Mini timeline */}
        <div className="grid grid-cols-3 gap-1.5 -mx-1 border-y border-gray-100 dark:border-white/5 py-2.5">
          {dias.slice(0, 3).map((d, i) => (
            <Link key={d.id} href={`/eventos/${slug}?dia=${d.id}`}
              className="text-[10px] text-center hover:bg-[#EFF5FF] dark:hover:bg-white/5 rounded-md py-1 transition">
              <strong className="block text-[#0D2B4E] dark:text-white text-[11px]">Dia {i + 1}</strong>
              <span className="text-gray-400">{fmtData(d.data)}</span>
              <span className="block text-[9px] mt-0.5 text-[#2E7DD1] dark:text-[#5BA4E5] font-semibold">
                {(d.total_fotos ?? 0).toLocaleString("pt-BR")} fotos
              </span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/eventos/${slug}`}
            className="h-10 rounded-xl border border-gray-200 dark:border-white/10 text-[#0D2B4E] dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Ver evento <ChevronRight size={12} />
          </Link>
          <Link href={`/eventos/${slug}?view=minhas`}
            className="h-10 rounded-xl bg-gradient-to-r from-[#2E7DD1] to-[#7a3cff] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition shadow">
            <ScanFace size={12} /> Minhas fotos
          </Link>
        </div>
      </div>
    </article>
  );
}
