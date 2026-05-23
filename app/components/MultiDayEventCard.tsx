"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Camera,
  ChevronRight,
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
  const dias = useMemo(() => evento.dias ?? [], [evento.dias]);
  const totalDias = dias.length;
  const totalFotos = dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0) || evento.total_fotos;
  const status = statusInfo(evento.status);
  const fallback: CapaPreview | null = useMemo(() => (
    evento.capa_id
      ? {
          id: evento.capa_id,
          position: evento.capa_position ?? "center",
          alt: evento.nome,
        }
      : null
  ), [evento.capa_id, evento.capa_position, evento.nome]);

  const capasIniciais: Array<CapaPreview | null> = useMemo(() => {
    const previews: Array<CapaPreview | null> = dias.slice(0, 3).map((dia) => {
      if (dia.capa_id) {
        return {
          id: dia.capa_id,
          position: dia.capa_position ?? "center",
          alt: dia.titulo || evento.nome,
        };
      }

      return fallback;
    });

    while (previews.length < 3) previews.push(fallback);
    return previews;
  }, [dias, evento.nome, fallback]);

  const [capasDrive, setCapasDrive] = useState<Array<CapaPreview | null>>([]);

  useEffect(() => {
    let cancelado = false;
    const diasPreview = dias.slice(0, 3);

    async function carregarPreviews() {
      const resultados = await Promise.all(
        diasPreview.map(async (dia) => {
          if (!dia.folder_id) return null;
          try {
            const res = await fetch(`/api/fotos?folderId=${encodeURIComponent(dia.folder_id)}`);
            if (!res.ok) return null;
            const data = await res.json();
            const foto = Array.isArray(data?.fotos) ? data.fotos[0] : null;
            if (!foto?.id) return null;
            return {
              id: foto.id as string,
              position: dia.capa_position ?? "center",
              alt: dia.titulo || evento.nome,
            };
          } catch {
            return null;
          }
        })
      );

      if (!cancelado) setCapasDrive(resultados);
    }

    carregarPreviews();
    return () => {
      cancelado = true;
    };
  }, [dias, evento.nome]);

  const capas = useMemo(() => {
    const misturadas = capasIniciais.map((capa, index) => capasDrive[index] ?? capa);
    const idsUsados = new Set<string>();

    return misturadas.map((capa) => {
      if (!capa) return null;
      if (idsUsados.has(capa.id)) return null;
      idsUsados.add(capa.id);
      return capa;
    });
  }, [capasDrive, capasIniciais]);

  return (
    <article className="group rounded-[1.75rem] border border-[#D4E3F7] bg-white p-5 shadow-[0_22px_70px_rgba(13,43,78,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_85px_rgba(13,43,78,0.18)] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20">
          <Layers size={16} /> {totalDias} dias
        </span>

        <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold ${status.className}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {capas.map((capa, index) => (
          <Link
            key={`${capa?.id ?? "placeholder"}-${index}`}
            href={dias[index] ? `/eventos/${slug}?dia=${dias[index].id}` : `/eventos/${slug}`}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#DCEBFF] to-[#F0E7FF]"
          >
            {capa ? (
              <img
                src={`/api/thumb?id=${capa.id}&sz=640`}
                alt={capa.alt}
                style={{ objectPosition: capa.position }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#EAF3FF] to-[#F5EDFF] text-[#2E7DD1]/55">
                <Camera size={30} />
              </div>
            )}
            {dias[index] && (
              <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-[#185BAB] shadow-sm">
                Dia {index + 1}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="max-w-3xl text-2xl font-black leading-tight text-[#071C3A] line-clamp-2">
          {evento.nome}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-base text-[#5F708A]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={18} />
            {fmtData(evento.data)}{evento.data_fim ? ` a ${fmtData(evento.data_fim)}` : ""}
          </span>
          <span className="hidden h-5 w-px bg-[#D7E2F0] sm:block" />
          <span className="inline-flex items-center gap-1.5">
            <Camera size={18} />
            {totalFotos.toLocaleString("pt-BR")} fotos
          </span>
        </div>
      </div>

      <div className="mt-5 border-t border-[#DDE8F7] pt-5">
        <div className="mb-3 flex items-center gap-2 text-base font-black text-[#071C3A]">
          <Calendar size={18} className="text-[#1E63FF]" />
          Dias do evento
        </div>

        <div className="grid grid-cols-3 gap-3">
          {dias.slice(0, 3).map((dia, index) => {
            const fotosDia = dia.total_fotos ?? 0;

            return (
              <Link
                key={dia.id}
                href={`/eventos/${slug}?dia=${dia.id}`}
                className="rounded-2xl border border-[#DCE7F5] bg-[#FBFDFF] p-4 transition hover:border-[#2E7DD1]/45 hover:bg-[#F4F9FF]"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2E7DD1] to-[#8A3FFC] text-base font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-base text-[#0D2B4E]">Dia {index + 1}</strong>
                    <span className="block truncate text-sm text-[#6D7F98]">{fmtData(dia.data)}</span>
                  </div>
                </div>
                <span className="mt-3 inline-flex max-w-full items-center gap-1 rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-bold text-[#2E7DD1]">
                  {fotosDia > 0 ? (
                    <>
                      <Camera size={12} /> {fotosDia.toLocaleString("pt-BR")} fotos
                    </>
                  ) : (
                    <>
                      <ChevronRight size={12} /> Ver dia
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
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#BFD2EC] bg-white text-base font-black text-[#0D2B4E] transition hover:bg-[#F4F8FF]"
        >
          <FolderOpen size={17} />
          Ver dias do evento
          <ChevronRight size={15} />
        </Link>
        <Link
          href={`/eventos/${slug}?view=minhas`}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] text-base font-black text-white shadow-lg shadow-blue-600/20 transition hover:brightness-105"
        >
          <ScanFace size={17} />
          Buscar minhas fotos
        </Link>
      </div>
    </article>
  );
}
