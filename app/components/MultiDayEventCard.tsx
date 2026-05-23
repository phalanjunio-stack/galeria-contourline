"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Camera, ChevronRight, FolderOpen, Layers, ScanFace } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import EventCardActions from "@/app/components/EventCardActions";
import EventCardMetrics from "@/app/components/EventCardMetrics";

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

interface Props {
  evento: EventoItem;
  slug: string;
}

export default function MultiDayEventCard({ evento, slug }: Props) {
  const dias = useMemo(() => evento.dias ?? [], [evento.dias]);
  const totalDias = dias.length;
  const fallback: CapaPreview | null = useMemo(() => (
    evento.capa_id
      ? { id: evento.capa_id, position: evento.capa_position ?? "center", alt: evento.nome }
      : null
  ), [evento.capa_id, evento.capa_position, evento.nome]);

  const capasIniciais: Array<CapaPreview | null> = useMemo(() => {
    const previews = dias.slice(0, 3).map((dia) => (
      dia.capa_id
        ? { id: dia.capa_id, position: dia.capa_position ?? "center", alt: dia.titulo || evento.nome }
        : fallback
    ));
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
    <article className="overflow-hidden rounded-xl border border-[#D7E6FA] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#7C3AED]/50 hover:shadow-[0_10px_30px_rgba(46,125,209,0.16)] dark:border-[#3B5B82] dark:bg-[#102A44] dark:hover:border-[#8CC3FF]/50">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#2E7DD1] to-[#7C3AED] px-3 py-1.5 text-xs font-medium text-white">
          <Layers size={13} /> {totalDias} dias
        </span>
        <span className="rounded-md bg-[#EFF6FF] px-2.5 py-1.5 text-[10px] font-medium text-[#2E7DD1] dark:bg-white/10 dark:text-[#9BCBFF]">
          Por dia
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {capas.map((capa, index) => {
          const dia = dias[index];
          const fotosDia = dia?.total_fotos ?? 0;

          return (
            <Link
              key={`${capa?.id ?? "placeholder"}-${index}`}
              href={dia ? `/eventos/${slug}?dia=${dia.id}` : `/eventos/${slug}`}
                className="group/foto relative aspect-[4/5] overflow-hidden rounded-md bg-[#EFF5FF] ring-1 ring-[#D7E6FA] dark:bg-white/5 dark:ring-white/15"
            >
              {capa ? (
                <img
                  src={`/api/thumb?id=${capa.id}&sz=640`}
                  alt={capa.alt}
                  style={{ objectPosition: capa.position }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/foto:scale-105"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-[#2E7DD1]/45">
                  <Camera size={22} />
                </div>
              )}

              {index === 0 && (
                <div className="absolute left-1 top-1 z-10">
                  <EventCardMetrics slug={slug} compact />
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07182f]/78 via-[#07182f]/28 to-transparent px-1.5 pb-1.5 pt-7">
                <span className="mb-1 inline-flex rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#185BAB] shadow-sm">
                  Dia {index + 1}
                </span>
                {dia && (
                  <div className="space-y-0.5 text-[10px] font-medium text-white/90">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {fmtData(dia.data)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera size={10} /> {fotosDia.toLocaleString("pt-BR")} fotos
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-[#071C3A] dark:text-white">
          {evento.nome}
        </h3>
        <EventCardActions slug={slug} nome={evento.nome} />
      </div>

        <div className="mt-3 border-t border-[#DDE8F7] pt-3 dark:border-white/15">
          <div className="grid grid-cols-3 divide-x divide-[#E5EDF8] rounded-md border border-[#E5EDF8] bg-white dark:divide-white/10 dark:border-white/12 dark:bg-transparent">
            {dias.slice(0, 3).map((dia, index) => {
              const fotosDia = dia.total_fotos ?? 0;
              return (
                <Link
                  key={dia.id}
                  href={`/eventos/${slug}?dia=${dia.id}`}
                  className="p-2 transition hover:bg-[#F4F9FF] dark:hover:bg-white/10"
                >
                  <div className="flex items-center gap-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#EEF4FF] text-xs font-medium text-[#2E7DD1] dark:bg-white/10 dark:text-[#9BCBFF]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-xs font-medium text-[#0D2B4E] dark:text-white">
                      Dia {index + 1}
                    </strong>
                    <span className="block truncate text-[10px] font-normal text-[#6D7F98] dark:text-white/60">
                      {fmtData(dia.data)}
                    </span>
                  </div>
                </div>
                <span className="mt-2 inline-flex max-w-full items-center gap-1 text-[10px] font-normal text-[#2E7DD1] dark:text-[#9BCBFF]">
                  {fotosDia > 0 ? (
                    <>
                      <Camera size={10} /> {fotosDia.toLocaleString("pt-BR")}
                    </>
                  ) : (
                    <>
                      <ChevronRight size={10} /> Ver
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/eventos/${slug}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#BFD2EC] bg-white text-xs font-medium text-[#0D2B4E] transition hover:bg-[#F4F8FF] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
        >
          <FolderOpen size={14} />
          Ver dias
          <ChevronRight size={13} />
        </Link>
        <Link
          href={`/eventos/${slug}?view=minhas`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#2E7DD1] to-[#7C3AED] text-xs font-medium text-white transition hover:brightness-105"
        >
          <ScanFace size={14} />
          Minhas fotos
        </Link>
      </div>
    </article>
  );
}
