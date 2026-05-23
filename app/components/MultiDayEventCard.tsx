"use client";

import Link from "next/link";
import {
  Calendar,
  Camera,
  ChevronRight,
  Clock3,
  FolderOpen,
  Layers,
  ScanFace,
} from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

type CapaPreview = {
  id: string;
  position: string;
  alt: string;
};

function fmtData(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function statusInfo(status?: string) {
  const normalizado = (status ?? "aberto").toLowerCase();

  if (normalizado.includes("encerr") || normalizado.includes("fech")) {
    return {
      label: "Encerrado",
      className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/10 dark:text-gray-300 dark:border-white/10",
    };
  }

  if (normalizado.includes("priv")) {
    return {
      label: "Privado",
      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-400/20",
    };
  }

  return {
    label: "Aberto",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-300/20",
  };
}

interface Props {
  evento: EventoItem;
  slug: string;
}

export default function MultiDayEventCard({ evento, slug }: Props) {
  const dias = evento.dias ?? [];
  const totalDias = dias.length;
  const totalFotos = dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0) || evento.total_fotos;
  const status = statusInfo(evento.status);
  const fallback: CapaPreview | null = evento.capa_id
    ? {
        id: evento.capa_id,
        position: evento.capa_position ?? "center",
        alt: evento.nome,
      }
    : null;

  const capas: Array<CapaPreview | null> = dias.slice(0, 3).map((dia) => {
    if (dia.capa_id) {
      return {
        id: dia.capa_id,
        position: dia.capa_position ?? "center",
        alt: dia.titulo || evento.nome,
      };
    }

    return fallback;
  });

  while (capas.length < 3) capas.push(fallback);

  return (
    <article className="group rounded-[1.35rem] border border-[#B8D5F8] bg-white p-4 shadow-[0_18px_45px_rgba(13,43,78,0.10)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(13,43,78,0.16)] dark:border-white/10 dark:bg-[#07182f]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] px-3 py-1.5 text-xs font-extrabold text-white shadow-md">
          <Layers size={13} /> {totalDias} dias
        </span>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold ${status.className}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {capas.map((capa, index) => (
          <Link
            key={`${capa?.id ?? "placeholder"}-${index}`}
            href={dias[index] ? `/eventos/${slug}?dia=${dias[index].id}` : `/eventos/${slug}`}
            className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-[#DCEBFF] to-[#F0E7FF]"
          >
            {capa ? (
              <img
                src={`/api/thumb?id=${capa.id}&sz=640`}
                alt={capa.alt}
                style={{ objectPosition: capa.position }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[#2E7DD1]/55">
                <Camera size={24} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#07182f]/45 to-transparent" />
            {dias[index] && (
              <span className="absolute bottom-2 left-2 rounded-full bg-white/92 px-2 py-0.5 text-[10px] font-extrabold text-[#185BAB] shadow-sm">
                Dia {index + 1}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-black leading-tight text-[#071C3A] line-clamp-2 dark:text-white">
          {evento.nome}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#5F708A] dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={15} />
            {fmtData(evento.data)}{evento.data_fim ? ` a ${fmtData(evento.data_fim)}` : ""}
          </span>
          <span className="hidden h-4 w-px bg-[#D7E2F0] sm:block dark:bg-white/10" />
          <span className="inline-flex items-center gap-1.5">
            <Camera size={15} />
            {totalFotos.toLocaleString("pt-BR")} fotos
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-[#DDE8F7] pt-4 dark:border-white/10">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#071C3A] dark:text-white">
          <Calendar size={16} className="text-[#1E63FF]" />
          Dias do evento
        </div>

        <div className="grid grid-cols-3 gap-2">
          {dias.slice(0, 3).map((dia, index) => {
            const fotosDia = dia.total_fotos ?? 0;

            return (
              <Link
                key={dia.id}
                href={`/eventos/${slug}?dia=${dia.id}`}
                className="rounded-xl border border-[#DCE7F5] bg-[#F8FBFF] p-2.5 transition hover:border-[#2E7DD1]/45 hover:bg-[#EFF6FF] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2E7DD1] to-[#8A3FFC] text-sm font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-[#0D2B4E] dark:text-white">Dia {index + 1}</strong>
                    <span className="block truncate text-[11px] text-[#6D7F98] dark:text-gray-400">{fmtData(dia.data)}</span>
                  </div>
                </div>
                <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#2E7DD1] shadow-sm dark:bg-[#07182f] dark:text-[#8CC3FF]">
                  {fotosDia > 0 ? (
                    <>
                      <Camera size={10} /> {fotosDia.toLocaleString("pt-BR")} fotos
                    </>
                  ) : (
                    <>
                      <Clock3 size={10} /> Aguardando
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href={`/eventos/${slug}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#BFD2EC] bg-white text-sm font-black text-[#0D2B4E] transition hover:bg-[#F4F8FF] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          <FolderOpen size={17} />
          Ver dias
          <ChevronRight size={15} />
        </Link>
        <Link
          href={`/eventos/${slug}?view=minhas`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:brightness-105"
        >
          <ScanFace size={17} />
          Minhas fotos
        </Link>
      </div>
    </article>
  );
}
