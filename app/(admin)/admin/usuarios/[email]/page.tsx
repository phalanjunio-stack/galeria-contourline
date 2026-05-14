"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, ScanFace, Images, Loader2,
  Calendar, Mail, Download, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface UsuarioInfo {
  email: string;
  nome: string;
  foto: string;
  thumb: string | null;
  temDescriptor: boolean;
  notificar_site: boolean;
  criado_em: string;
}

interface EventoMatch {
  eventoId: string;
  eventoNome: string;
  processadoEm: string;
  fotosIds: string[];
}

function tempo(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function Avatar({ u }: { u: UsuarioInfo }) {
  const [err, setErr] = useState(false);
  const src = u.thumb || u.foto;
  if (src && !err) return (
    <img src={src} alt={u.nome} onError={() => setErr(true)}
      className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md" />
  );
  return (
    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-md"
      style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
      {(u.nome || u.email)[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function UsuarioGaleriaPage() {
  const params = useParams();
  const router = useRouter();
  const emailParam = decodeURIComponent(params.email as string);

  const [usuario,    setUsuario]    = useState<UsuarioInfo | null>(null);
  const [eventos,    setEventos]    = useState<EventoMatch[]>([]);
  const [eventoAtivo, setEventoAtivo] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [fotoSel,    setFotoSel]    = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        // Carrega info do usuário
        const usRes = await fetch("/api/usuarios");
        if (usRes.ok) {
          const lista: UsuarioInfo[] = await usRes.json();
          const u = lista.find(u => u.email === emailParam) ?? null;
          setUsuario(u);
        }

        // Carrega lista de eventos para buscar matches
        const evRes = await fetch("/api/eventos");
        const evLista = evRes.ok ? await evRes.json() : [];

        // Para cada evento, verifica se tem match salvo para este usuário
        const evMatches: EventoMatch[] = [];
        await Promise.all(
          (evLista as { id: string; nome: string }[]).map(async (ev) => {
            try {
              const mRes = await fetch(`/api/matches?eventoId=${ev.id}`);
              if (!mRes.ok) return;
              const data = await mRes.json();
              if (!data) return;
              const userMatch = data.usuarios?.find(
                (u: { email: string; fotosIds: string[] }) => u.email === emailParam
              );
              if (userMatch && userMatch.fotosIds?.length > 0) {
                evMatches.push({
                  eventoId:    ev.id,
                  eventoNome:  ev.nome,
                  processadoEm: data.processadoEm,
                  fotosIds:    userMatch.fotosIds,
                });
              }
            } catch { /**/ }
          })
        );

        evMatches.sort((a, b) => b.processadoEm.localeCompare(a.processadoEm));
        setEventos(evMatches);
        if (evMatches.length > 0) setEventoAtivo(evMatches[0].eventoId);
      } catch { /**/ }
      setCarregando(false);
    }
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailParam]);

  const eventoSelecionado = eventos.find(e => e.eventoId === eventoAtivo);
  const totalFotos = eventos.reduce((acc, e) => acc + e.fotosIds.length, 0);

  if (carregando) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[#2E7DD1]">
      <Loader2 size={24} className="animate-spin" />
      <span className="text-sm font-medium">Carregando galeria...</span>
    </div>
  );

  if (!usuario) return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <User size={40} className="text-gray-200 mx-auto mb-3" />
      <p className="font-semibold text-[#0D2B4E]">Usuário não encontrado</p>
      <button onClick={() => router.back()} className="mt-4 text-[#2E7DD1] text-sm hover:underline flex items-center gap-1 mx-auto">
        <ArrowLeft size={14} /> Voltar
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-[#EFF5FF] hover:text-[#1A4A80] transition">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#0D2B4E]">Galeria do usuário</h1>
          <p className="text-gray-400 text-sm">Fotos encontradas por reconhecimento facial</p>
        </div>
      </div>

      {/* Card do usuário */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4">
          <Avatar u={usuario} />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-[#0D2B4E] truncate">{usuario.nome || "—"}</h2>
            <p className="text-gray-400 text-sm flex items-center gap-1.5 mt-0.5 truncate">
              <Mail size={13} /> {usuario.email}
            </p>
            <p className="text-gray-300 text-xs flex items-center gap-1.5 mt-1">
              <Calendar size={11} /> Cadastrado em {tempo(usuario.criado_em)}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {usuario.temDescriptor && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ScanFace size={10} /> Rosto cadastrado
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EFF5FF] text-[#1A4A80] border border-[#2E7DD1]/20">
                <Images size={10} /> {totalFotos} foto{totalFotos !== 1 ? "s" : ""} encontrada{totalFotos !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sem fotos */}
      {eventos.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Images size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-[#0D2B4E] mb-1">Nenhuma foto encontrada</p>
          <p className="text-gray-400 text-sm mb-4">
            Este usuário ainda não foi identificado em nenhum evento indexado.
          </p>
          <Link href="/admin/reconhecimento"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow hover:opacity-90 transition">
            <ScanFace size={14} /> Ir para Reconhecimento
          </Link>
        </div>
      )}

      {/* Abas de eventos */}
      {eventos.length > 0 && (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {eventos.map(ev => (
              <button key={ev.eventoId}
                onClick={() => setEventoAtivo(ev.eventoId)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  eventoAtivo === ev.eventoId
                    ? "gradient-primary text-white shadow"
                    : "border border-gray-200 text-gray-500 hover:bg-[#EFF5FF] hover:text-[#1A4A80]"
                }`}>
                <Images size={11} />
                {ev.eventoNome}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  eventoAtivo === ev.eventoId
                    ? "bg-white/25 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}>{ev.fotosIds.length}</span>
              </button>
            ))}
          </div>

          {eventoSelecionado && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-[#0D2B4E]">{eventoSelecionado.fotosIds.length}</span> foto{eventoSelecionado.fotosIds.length !== 1 ? "s" : ""} em <em>{eventoSelecionado.eventoNome}</em>
                </p>
                <span className="text-[11px] text-gray-300">
                  Indexado {tempo(eventoSelecionado.processadoEm)}
                </span>
              </div>

              {/* Grade de fotos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {eventoSelecionado.fotosIds.map(id => (
                  <div key={id}
                    className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-100"
                    onClick={() => setFotoSel(id === fotoSel ? null : id)}>
                    <div className="aspect-[4/3] bg-[#EFF5FF]">
                      <img
                        src={`/api/thumb?id=${id}&sz=400`}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    {/* Ações no hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                      <a
                        href={`/api/thumb?id=${id}&sz=1200`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-[#0D2B4E] hover:bg-white transition shadow"
                        title="Ver em tamanho maior">
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={`/api/thumb?id=${id}&sz=1200`}
                        download
                        onClick={e => e.stopPropagation()}
                        className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-[#0D2B4E] hover:bg-white transition shadow"
                        title="Baixar foto">
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Lightbox simples */}
      {fotoSel && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setFotoSel(null)}>
          <img
            src={`/api/thumb?id=${fotoSel}&sz=1200`}
            alt=""
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
