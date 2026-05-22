"use client";
import Link from "next/link";
import { Calendar, ScanFace } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

const statusConfig: Record<string, { bg: string; dot: string; label: string }> = {
  aberto:    { bg: "from-[#2E7DD1] to-[#7a3cff]", dot: "bg-white", label: "Aberto"    },
  privado:   { bg: "from-amber-500 to-amber-400",  dot: "bg-white", label: "Privado"   },
  encerrado: { bg: "from-gray-500 to-gray-400",    dot: "bg-gray-200", label: "Encerrado" },
};

interface Props {
  evento: EventoItem;
  slug: string;
  encontrado?: boolean;
}

export default function SingleEventCard({ evento, slug, encontrado }: Props) {
  const st = statusConfig[evento.status] ?? statusConfig.encerrado;

  return (
    <Link href={`/eventos/${slug}${encontrado ? "?filtro=minhas" : ""}`} className="group block">
      <div
        className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}
      >
        {evento.capa_id
          ? <img src={`/api/thumb?id=${evento.capa_id}&sz=600`} alt={evento.nome}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/20 text-5xl">📷</span>
            </div>
        }

        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/90 via-[#0D2B4E]/20 to-transparent" />

        {/* Badge status */}
        <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${st.bg} text-white text-[10px] font-bold shadow`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </div>

        {/* Badge "você está aqui" */}
        {encontrado && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 text-[#1A4A80] text-[10px] font-bold shadow">
            <ScanFace size={10} /> Você está aqui
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 mb-1.5">{evento.nome}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-white/70 text-[10px]">
              <Calendar size={10} />
              <span>{new Date(evento.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
            {evento.total_fotos > 0 && (
              <span className="text-white/80 text-[10px] font-semibold">{evento.total_fotos} fotos</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
