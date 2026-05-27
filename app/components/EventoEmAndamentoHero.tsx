"use client";

import Link from "next/link";
import { Calendar, MapPin, ScanFace, FolderOpen, Camera, Users, Sparkles, Check, Circle } from "lucide-react";
import type { EventoItem, EventoDia } from "@/app/api/eventos/route";

interface Props {
  eventos: EventoItem[];
}

/** Compara só ano/mês/dia em horário local — evita confusão de timezone. */
function diaIso(iso: string): string {
  if (!iso) return "";
  // Aceita "2026-05-08" ou ISO completo
  return iso.length > 10 ? iso.slice(0, 10) : iso;
}

function hojeIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDataCurta(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

function fmtDataLonga(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

/** Acha o evento que está rolando hoje (data ≤ hoje ≤ data_fim ou dia interno = hoje). */
function acharEventoEmAndamento(eventos: EventoItem[]): EventoItem | null {
  const hoje = hojeIso();
  const candidatos = eventos.filter(e => e.status === "aberto");

  // 1. Multi-dia com algum dia = hoje
  for (const ev of candidatos) {
    if (ev.dias?.some(d => diaIso(d.data) === hoje)) return ev;
  }
  // 2. data ≤ hoje ≤ data_fim
  for (const ev of candidatos) {
    const d1 = diaIso(ev.data);
    const d2 = diaIso(ev.data_fim ?? ev.data);
    if (d1 && d2 && d1 <= hoje && hoje <= d2) return ev;
  }
  return null;
}

/** Status de um dia em relação a hoje: feito / ativo / futuro. */
function statusDoDia(dia: EventoDia): "feito" | "ativo" | "futuro" {
  const hoje = hojeIso();
  const dd = diaIso(dia.data);
  if (dd === hoje) return "ativo";
  if (dd < hoje)  return "feito";
  return "futuro";
}

export default function EventoEmAndamentoHero({ eventos }: Props) {
  const evento = acharEventoEmAndamento(eventos);
  if (!evento) return null;

  // Contagem real vem direto do /api/eventos (server lê _matches_*.json)
  const pessoas = evento.pessoas_encontradas ?? 0;

  const dias = evento.dias ?? [];
  const diaAtivoIdx = dias.findIndex(d => diaIso(d.data) === hojeIso());
  // Banner dedicado tem prioridade; depois cai pra capa do dia ativo; por fim capa do evento.
  const bannerId = evento.banner_id ?? null;
  const capaId   = bannerId
    ?? (diaAtivoIdx >= 0 ? dias[diaAtivoIdx].capa_id : null)
    ?? evento.capa_id;
  const objectPosition = bannerId
    ? (evento.banner_position ?? "center right")
    : (evento.capa_position ?? "center right");
  const diaLabel = dias.length > 0 && diaAtivoIdx >= 0
    ? `Dia ${diaAtivoIdx + 1} de ${dias.length}`
    : null;

  const periodo = evento.data_fim && evento.data_fim !== evento.data
    ? `${fmtDataLonga(evento.data)} a ${fmtDataLonga(evento.data_fim).split(" de ").slice(1).join(" de ")}`
    : fmtDataLonga(evento.data);

  return (
    <article
      className="relative mb-8 overflow-hidden rounded-2xl border border-[#1F3A5F] shadow-xl"
      style={{ background: "linear-gradient(135deg, #0A1A2E 0%, #102A44 100%)" }}
    >
      {/* Imagem de fundo (capa do evento ou dia ativo) */}
      {capaId && (
        <>
          <img
            src={`/api/thumb?id=${capaId}&sz=1600`}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition }}
          />
          {/* Camada 1 — fade horizontal: esquerda 100% opaca → direita translúcida */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(10,26,46,1) 0%, rgba(10,26,46,0.96) 28%, rgba(10,26,46,0.65) 60%, rgba(10,26,46,0.15) 100%)",
            }}
          />
          {/* Camada 2 — vinheta vertical: escurece topo/base, mantém meio com brilho */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,26,46,0.55) 0%, rgba(10,26,46,0) 30%, rgba(10,26,46,0) 70%, rgba(10,26,46,0.55) 100%)",
            }}
          />
          {/* Camada 3 — máscara radial: foco na direita, dissolve nos cantos */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 90% at 85% 50%, transparent 0%, rgba(10,26,46,0.35) 70%, rgba(10,26,46,0.7) 100%)",
            }}
          />
        </>
      )}

      {/* Badge "Dia X de Y" no canto sup direito */}
      {diaLabel && (
        <div className="absolute right-4 top-4 z-10">
          <span className="inline-flex items-center rounded-md bg-gradient-to-br from-[#2E7DD1] to-[#5BA4E5] px-3 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/15">
            {diaLabel}
          </span>
        </div>
      )}

      <div className="relative z-[1] grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:gap-8 md:p-7">
        {/* ── Esquerda: badge + título + meta + stats + CTAs ── */}
        <div className="min-w-0">
          {/* Badge "Evento em andamento" */}
          <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Evento em andamento
          </div>

          {/* Título */}
          <h2 className="mb-3 text-2xl font-bold leading-tight text-white md:text-3xl">
            {evento.nome}
          </h2>

          {/* Data + Local */}
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} className="text-white/55" /> {periodo}
            </span>
            {evento.local && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-white/55" /> {evento.local}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            <Stat
              label="Fotos disponíveis"
              value={evento.total_fotos.toLocaleString("pt-BR")}
              icon={<Camera size={11} className="text-[#5BA4E5]" />}
            />
            <Stat
              label="Pessoas encontradas"
              value={pessoas.toLocaleString("pt-BR")}
              icon={<Users size={11} className="text-[#5BA4E5]" />}
            />
            <Stat
              label="Reconhecimento facial"
              value={evento.reconhecimento_facial ? "Ativa" : "Off"}
              prefix={evento.reconhecimento_facial ? "IA" : ""}
              icon={<Sparkles size={11} className="text-[#5BA4E5]" />}
              highlight={evento.reconhecimento_facial}
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/eventos/${evento.id}?filtro=minhas`}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E7DD1] to-[#5BA4E5] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
            >
              <ScanFace size={15} /> Encontrar minhas fotos
            </Link>
            <Link
              href={`/eventos/${evento.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              <FolderOpen size={15} /> {dias.length > 0 ? "Ver todos os dias" : "Ver evento completo"}
            </Link>
          </div>
        </div>

        {/* ── Direita: timeline dos dias (só se multi-dia) ── */}
        {dias.length > 0 && (
          <div className="flex flex-col justify-center gap-2">
            {dias.map((dia, i) => {
              const st = statusDoDia(dia);
              return (
                <Link
                  key={dia.id}
                  href={`/eventos/${evento.id}?dia=${dia.id}`}
                  className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition
                    ${st === "ativo"
                      ? "border-[#5BA4E5] bg-[#2E7DD1]/15 ring-1 ring-[#5BA4E5]/40"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"}`}
                >
                  <DiaIcon status={st} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${st === "ativo" ? "text-white" : "text-white/80"}`}>
                        Dia {i + 1}
                      </span>
                      <span className="text-[10px] text-white/55">
                        {fmtDataCurta(dia.data)}
                        {dia.titulo ? ` • ${dia.titulo.replace(/^Dia\s*\d+\s*[—–-]\s*/i, "")}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/55">
                      {(dia.total_fotos ?? 0).toLocaleString("pt-BR")} fotos
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────────── */

function Stat({
  label, value, icon, prefix, highlight,
}: {
  label: string; value: string; icon: React.ReactNode;
  prefix?: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-sm">
      <div className="flex items-baseline gap-1.5">
        {prefix && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5BA4E5]">{prefix}</span>
        )}
        <span className={`text-xl font-black leading-none ${highlight ? "text-emerald-300" : "text-white"}`}>
          {value}
        </span>
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-white/55">
        {icon} {label}
      </div>
    </div>
  );
}

function DiaIcon({ status }: { status: "feito" | "ativo" | "futuro" }) {
  if (status === "feito") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500/90 text-white shadow">
        <Check size={14} strokeWidth={3} />
      </span>
    );
  }
  if (status === "ativo") {
    return (
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2E7DD1] text-white shadow ring-2 ring-[#5BA4E5]/50">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5BA4E5] opacity-50" />
        <span className="relative h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/25 bg-white/5 text-white/40">
      <Circle size={12} />
    </span>
  );
}
