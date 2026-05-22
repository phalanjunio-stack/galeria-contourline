"use client";
import Link from "next/link";
import { Calendar, MapPin, Camera, Users, Layers, ScanFace, ChevronRight, Sparkles } from "lucide-react";
import type { EventoItem, EventoDia } from "@/app/api/eventos/route";

function fmtData(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function fmtCurto(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  catch { return iso; }
}

interface Props {
  evento: EventoItem;
  slug: string;
  minhasFotosPorDia?: Record<string, number>;
}

export default function EventoOverview({ evento, slug, minhasFotosPorDia = {} }: Props) {
  const dias = evento.dias ?? [];
  const totalFotos = dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0) || evento.total_fotos;
  const minhasTotal = Object.values(minhasFotosPorDia).reduce((s, n) => s + n, 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
      {/* Resumo */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-[#0D2B4E] to-[#1A4A80] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#5BA4E5]" />
            <span className="text-[11px] font-bold text-[#5BA4E5] uppercase tracking-wider">Resumo</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-3xl font-black">{dias.length}</div>
              <div className="text-xs text-white/60">dia{dias.length !== 1 ? "s" : ""} de evento</div>
            </div>
            <div>
              <div className="text-3xl font-black">{totalFotos.toLocaleString("pt-BR")}</div>
              <div className="text-xs text-white/60">fotos disponíveis</div>
            </div>
            <div>
              <div className="text-3xl font-black">{minhasTotal}</div>
              <div className="text-xs text-white/60">suas fotos</div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                IA ativa
              </div>
              <div className="text-xs text-white/60">reconhecimento facial</div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2.5">
          <Link href={`/eventos/${slug}?view=minhas`}
            className="h-14 rounded-2xl bg-gradient-to-r from-[#2E7DD1] to-[#7a3cff] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition">
            <ScanFace size={16} /> Buscar minhas fotos no evento inteiro
          </Link>
          <Link href={`/eventos/${slug}?view=todas`}
            className="h-12 rounded-2xl border border-[#2E7DD1]/30 dark:border-[#5BA4E5]/30 text-[#1A4A80] dark:text-[#5BA4E5] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#EFF5FF] dark:hover:bg-white/5 transition">
            Ver todas as fotos do evento
          </Link>
        </div>
      </div>

      {/* Cards dos dias */}
      <h2 className="text-xl font-bold text-[#0D2B4E] dark:text-white mb-4 flex items-center gap-2">
        <Layers size={18} className="text-[#2E7DD1]" /> Escolha um dia
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dias.map((d, i) => <DiaCard key={d.id} dia={d} ordem={i + 1} slug={slug} minhas={minhasFotosPorDia[d.id]} />)}
      </div>
    </div>
  );
}

function DiaCard({ dia, ordem, slug, minhas }: { dia: EventoDia; ordem: number; slug: string; minhas?: number }) {
  const status = dia.status ?? "disponivel";
  const statusLabel = status === "processando" ? "Processando" : status === "fechado" ? "Fechado" : "Disponível";
  const statusColor = status === "processando" ? "bg-amber-400" : status === "fechado" ? "bg-gray-400" : "bg-emerald-400";

  return (
    <article className="bg-white dark:bg-[#0a1a2f]/80 border border-[#2E7DD1]/15 dark:border-[#5BA4E5]/15 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      <div className="h-32 relative bg-gradient-to-br from-[#2E7DD1] to-[#7a3cff] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/70 to-transparent" />
        <div className="relative z-10 text-center">
          <div className="text-white/70 text-xs font-bold uppercase tracking-widest">Dia</div>
          <div className="text-white text-5xl font-black leading-none">{ordem}</div>
        </div>
        <span className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur text-white text-[10px] font-bold`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} /> {statusLabel}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-[#0D2B4E] dark:text-white text-base leading-tight">{dia.titulo}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
            <Calendar size={11} /> {fmtData(dia.data)}
          </p>
        </div>
        {dia.descricao && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{dia.descricao}</p>}

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-[#1A4A80] dark:text-[#5BA4E5] font-semibold">
            <Camera size={12} />
            {(dia.total_fotos ?? 0).toLocaleString("pt-BR")} fotos
          </div>
          {typeof minhas === "number" && minhas > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ScanFace size={12} /> {minhas} suas
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href={`/eventos/${slug}?dia=${dia.id}`}
            className="h-9 rounded-xl border border-gray-200 dark:border-white/10 text-[#0D2B4E] dark:text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Ver fotos <ChevronRight size={11} />
          </Link>
          <Link href={`/eventos/${slug}?dia=${dia.id}&view=minhas`}
            className="h-9 rounded-xl bg-gradient-to-r from-[#2E7DD1] to-[#7a3cff] text-white text-xs font-bold flex items-center justify-center gap-1 hover:opacity-90 transition shadow">
            <ScanFace size={11} /> Minhas
          </Link>
        </div>
      </div>
    </article>
  );
}
