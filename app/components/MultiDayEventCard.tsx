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
      ? {
          id: evento.capa_id,
          position: evento.capa_position ?? "center",
          alt: evento.nome,
        }
      : null
  ), [evento.capa_id, evento.capa_position, evento.nome]);

  const capasIniciais: Array<CapaPreview | null> = useMemo(() => {
    const previews = dias.slice(0, 3).map((dia) => {
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
    <article className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2E7DD1] via-[#5578FF] to-[#8A3FFC] p-[1.5px] shadow-[0_16px_42px_rgba(13,43,78,0.13)] transition-all duration-300 before:absolute before:-inset-20 before:bg-[conic-gradient(from_0deg,#2E7DD1,#8A3FFC,#00C8FF,#2E7DD1)] before:opacity-0 before:content-[''] hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(82,108,255,0.36)] hover:before:animate-[spin_3.5s_linear_infinite] hover:before:opacity-100">
      <div className="relative z-10 rounded-[14px] bg-white p-3.5 dark:bg-[#102A44]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/15">
            <Layers size={13} /> {totalDias} dias
          </span>
          <span className="rounded-md bg-[#EFF6FF] px-2.5 py-1.5 text-[10px] font-bold text-[#2E7DD1] dark:bg-white/10 dark:text-[#8CC3FF]">
            Por dia
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {capas.map((capa, index) => {
            const dia = dias[index];
            const fotosDia = dia?.total_fotos ?? 0;

            return (
              <Link
                key={`${capa?.id ?? "placeholder"}-${index}`}
                href={dia ? `/eventos/${slug}?dia=${dia.id}` : `/eventos/${slug}`}
                className="group/foto relative aspect-[4/5] overflow-hidden rounded-lg bg-gradient-to-br from-[#DCEBFF] to-[#F0E7FF] ring-1 ring-[#D7E6FA] dark:ring-white/20"
              >
                {capa ? (
                  <img
                    src={`/api/thumb?id=${capa.id}&sz=640`}
                    alt={capa.alt}
                    style={{ objectPosition: capa.position }}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/foto:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#EAF3FF] to-[#F5EDFF] text-[#2E7DD1]/55">
                    <Camera size={22} />
                  </div>
                )}
                {index === 0 && (
                  <div className="absolute right-1 top-1 z-10">
                    <EventCardMetrics slug={slug} compact />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07182f]/78 via-[#07182f]/26 to-transparent px-2 pb-2 pt-8">
                  <span className="mb-1 inline-flex rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-extrabold text-[#185BAB] shadow-sm">
                    Dia {index + 1}
                  </span>
                  {dia && (
                    <div className="space-y-0.5 text-[10px] font-semibold text-white/90">
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
          <h3 className="text-lg font-black leading-tight text-[#071C3A] line-clamp-2 dark:text-white">
            {evento.nome}
          </h3>
          <EventCardActions slug={slug} nome={evento.nome} />
        </div>

        <div className="mt-3 border-t border-[#DDE8F7] pt-3 dark:border-white/15">
          <div className="grid grid-cols-3 gap-2">
            {dias.slice(0, 3).map((dia, index) => {
              const fotosDia = dia.total_fotos ?? 0;

              return (
                <Link
                  key={dia.id}
                  href={`/eventos/${slug}?dia=${dia.id}`}
                  className="rounded-md border border-[#DCE7F5] bg-[#FBFDFF] p-2 transition hover:border-[#2E7DD1]/45 hover:bg-[#F4F9FF] dark:border-white/15 dark:bg-white/8 dark:hover:bg-white/12"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#2E7DD1] to-[#8A3FFC] text-xs font-black text-white shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-xs text-[#0D2B4E] dark:text-white">Dia {index + 1}</strong>
                      <span className="block truncate text-[10px] text-[#6D7F98] dark:text-white/60">{fmtData(dia.data)}</span>
                    </div>
                  </div>
                  <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-1 text-[10px] font-bold text-[#2E7DD1] dark:bg-white/10 dark:text-[#8CC3FF]">
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
            className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#BFD2EC] bg-white text-xs font-black text-[#0D2B4E] transition hover:bg-[#F4F8FF] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
          >
            <FolderOpen size={14} />
            Ver dias
            <ChevronRight size={13} />
          </Link>
          <Link
            href={`/eventos/${slug}?view=minhas`}
            className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#1E63FF] to-[#8A3FFC] text-xs font-black text-white shadow-lg shadow-blue-600/20 transition hover:brightness-105"
          >
            <ScanFace size={14} />
            Minhas fotos
          </Link>
        </div>
      </div>
    </article>
  );
}
