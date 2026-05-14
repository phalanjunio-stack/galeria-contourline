import Link from "next/link";
import { Calendar, Camera, Lock, Globe, CheckCircle } from "lucide-react";

export type EventStatus = "aberto" | "privado" | "encerrado";

export interface EventData {
  slug: string;
  nome: string;
  data: string;
  totalFotos: number;
  status: EventStatus;
  coverUrl?: string;
  categoria?: string;
}

const statusConfig = {
  aberto:    { label: "Aberto",    icon: Globe,       bg: "from-emerald-700 to-emerald-500",  dot: "bg-emerald-400" },
  privado:   { label: "Privado",   icon: Lock,        bg: "from-amber-700 to-amber-500",      dot: "bg-amber-400"   },
  encerrado: { label: "Encerrado", icon: CheckCircle, bg: "from-slate-700 to-slate-500",      dot: "bg-slate-400"   },
};

export default function EventCard({ event }: { event: EventData }) {
  const st = statusConfig[event.status];
  const StatusIcon = st.icon;

  return (
    <Link href={`/eventos/${event.slug}`} className="group block">
      <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white border border-gray-100">
        {/* Capa */}
        <div className="relative h-44 overflow-hidden">
          {event.coverUrl ? (
            <img
              src={event.coverUrl}
              alt={event.nome}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full gradient-hero flex items-center justify-center">
              <Camera size={40} className="text-white/40" />
            </div>
          )}
          {/* Overlay degradê */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/80 via-transparent to-transparent" />
          {/* Nome sobre a foto */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-base leading-tight line-clamp-2">{event.nome}</h3>
          </div>
          {/* Badge status */}
          <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${st.bg} text-white text-xs font-semibold shadow`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[#1A4A80] text-xs">
            <Calendar size={13} className="shrink-0" />
            <span className="font-medium">{event.data}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#2E7DD1] text-xs font-semibold">
            <Camera size={13} className="shrink-0" />
            <span>{event.totalFotos} fotos</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
