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
    // Datas "YYYY-MM-DD" sem hora sao parseadas como UTC meia-noite, o que no
    // Brasil (UTC-3) cai no dia anterior. Forca meio-dia local pra evitar o off-by-one.
    const base = iso.length <= 10 ? `${iso}T12:00:00` : iso;
    return new Date(base).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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

  // Mostra no maximo 3 tiles, UM por dia real — sem padding fantasma.
  // (antes preenchia ate 3 com fallback, criando um "Dia 3" inexistente)
  const capasIniciais: Array<CapaPreview | null> = useMemo(() => (
    dias.slice(0, 3).map((dia) => (
      dia.capa_id
        ? { id: dia.capa_id, position: dia.capa_position ?? "center", alt: dia.titulo || evento.nome }
        : fallback
    ))
  ), [dias, evento.nome, fallback]);

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
    <article className="event-card-multi overflow-hidden rounded-xl border p-3.5 shadow-sm transition hover:-translate-y-0.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#2E7DD1] to-[#7C3AED] px-3 py-1.5 text-xs font-medium text-white shrink-0">
            <Layers size={13} /> {totalDias} dias
          </span>
          <span className="event-card-muted-chip rounded-md px-2.5 py-1.5 text-[10px] font-medium shrink-0">
            Por dia
          </span>
        </div>
        {/* Métricas do card no header — antes ficavam absolute na primeira foto */}
        <div className="shrink-0">
          <EventCardMetrics slug={slug} compact />
        </div>
      </div>

      <div className={`grid gap-1.5 ${capas.length <= 1 ? "grid-cols-1" : capas.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {capas.map((capa, index) => {
          const dia = dias[index];
          const fotosDia = dia?.total_fotos ?? 0;
          const ehUltimoComMais = index === 2 && totalDias > 3;
          // Mostra +N = dias acessiveis via 'ver todos' (todos menos os 2 visiveis)
          const sobrando = totalDias - 2;

          return (
            <Link
              key={`${capa?.id ?? "placeholder"}-${index}`}
              href={ehUltimoComMais
                ? `/eventos/${slug}`
                : (dia ? `/eventos/${slug}?dia=${dia.id}` : `/eventos/${slug}`)}
              aria-label={ehUltimoComMais ? `Ver todos os ${totalDias} dias` : undefined}
              className="group/foto event-card-photo-tile relative aspect-[4/5] overflow-hidden rounded-md ring-1"
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

              {ehUltimoComMais ? (
                /* Overlay "+N dias" — cobre a foto, mantém ela visível como background */
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-[#07182f]/85 via-[#0D2B4E]/80 to-[#2E7DD1]/70 backdrop-blur-[1px] transition-opacity duration-300 group-hover/foto:from-[#07182f]/90 group-hover/foto:to-[#2E7DD1]/80" />
                  <div className="absolute inset-0 grid place-items-center text-center text-white">
                    <div>
                      <div className="text-3xl font-black leading-none tracking-tight">+{sobrando}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-90">
                        {sobrando === 1 ? "dia" : "dias"}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-0.5 text-[9px] font-semibold opacity-80">
                        Ver todos <ChevronRight size={10} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
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
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="event-card-title line-clamp-2 text-lg font-semibold leading-tight">
          {evento.nome}
        </h3>
        <EventCardActions slug={slug} nome={evento.nome} />
      </div>

        <div className="event-card-separator mt-3 border-t pt-3">
          <div className="event-card-day-strip grid grid-cols-3 rounded-md">
            {dias.slice(0, totalDias > 3 ? 2 : 3).map((dia, index) => {
              const fotosDia = dia.total_fotos ?? 0;
              return (
                <Link
                  key={dia.id}
                  href={`/eventos/${slug}?dia=${dia.id}`}
                  data-day-cell
                  className="event-card-day-link p-2 transition"
                >
                  <div className="flex items-center gap-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#2E7DD1] to-[#7C3AED] text-xs font-medium text-white shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="event-card-title block truncate text-xs font-medium">
                      Dia {index + 1}
                    </strong>
                    <span className="event-card-muted block truncate text-[10px] font-normal">
                      {fmtData(dia.data)}
                    </span>
                  </div>
                </div>
                <span className="mt-2 inline-flex max-w-full items-center gap-1 text-[10px] font-normal text-[#2E7DD1]">
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
          {totalDias > 3 && (
            <Link
              href={`/eventos/${slug}`}
              data-day-cell
              aria-label={`Ver todos os ${totalDias} dias`}
              className="event-card-day-link p-2 transition relative overflow-hidden"
            >
              <div className="flex items-center gap-1.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#07182f] to-[#2E7DD1] text-xs font-black text-white shadow-sm">
                  +{totalDias - 2}
                </span>
                <div className="min-w-0">
                  <strong className="event-card-title block truncate text-xs font-medium">
                    Ver todos
                  </strong>
                  <span className="event-card-muted block truncate text-[10px] font-normal">
                    {totalDias} dias
                  </span>
                </div>
              </div>
              <span className="mt-2 inline-flex max-w-full items-center gap-1 text-[10px] font-semibold text-[#2E7DD1]">
                <ChevronRight size={10} /> Abrir
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/eventos/${slug}`}
          className="event-card-secondary-button flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition"
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
