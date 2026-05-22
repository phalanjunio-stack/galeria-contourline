"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle,
  ImageIcon,
  Loader2,
  Search,
  Shield,
  X,
} from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import { lerRecognitionThresholdLocal } from "@/lib/recognition-thresholds";

type BuscaMatch = { eventoId: string; fotoId: string; dist: number };
type ResultadoEvento = { evento: EventoItem; fotos: BuscaMatch[] };

export default function BuscarPessoaPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "detecting" | "searching" | "done" | "error">("idle");
  const [erro, setErro] = useState("");
  const [resultados, setResultados] = useState<ResultadoEvento[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setStatus("idle");
      setErro("");
      setResultados([]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function buscarPessoa() {
    if (!preview) return;
    setStatus("detecting");
    setErro("");
    setResultados([]);

    try {
      const { loadFaceModels, detectorOptions } = await import("@/lib/faceapi-loader");
      const faceapi = await loadFaceModels();
      const img = await faceapi.fetchImage(preview);
      const detection = await faceapi
        .detectSingleFace(img, detectorOptions(faceapi, 0.4))
        .withFaceLandmarks(false)
        .withFaceDescriptor();

      if (!detection) {
        throw new Error("Nao achei um rosto claro nessa foto. Use uma foto de frente e bem iluminada.");
      }

      setStatus("searching");
      const eventosRes = await fetch("/api/eventos");
      const eventosData = eventosRes.ok ? await eventosRes.json() : [];
      const eventos = (Array.isArray(eventosData) ? eventosData : [])
        .filter((evento: EventoItem) => evento.status === "aberto" && evento.folder_id);

      if (eventos.length === 0) {
        throw new Error("Ainda nao ha eventos abertos e indexados para buscar.");
      }

      const buscaRes = await fetch("/api/pessoas/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoIds: eventos.map((evento: EventoItem) => evento.id),
          descriptors: [Array.from(detection.descriptor)],
          threshold: lerRecognitionThresholdLocal("resultado"),
        }),
      });
      const buscaData = buscaRes.ok ? await buscaRes.json() : null;
      const matches: BuscaMatch[] = Array.isArray(buscaData?.matches) ? buscaData.matches : [];

      const porEvento = new Map<string, BuscaMatch[]>();
      for (const match of matches) {
        if (!match?.eventoId || !match?.fotoId) continue;
        const fotos = porEvento.get(match.eventoId) ?? [];
        if (fotos.length < 60) fotos.push(match);
        porEvento.set(match.eventoId, fotos);
      }

      setResultados(eventos
        .map((evento: EventoItem) => ({ evento, fotos: porEvento.get(evento.id) ?? [] }))
        .filter((resultado: ResultadoEvento) => resultado.fotos.length > 0));
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErro(err instanceof Error ? err.message : "Nao foi possivel fazer a busca agora.");
    }
  }

  const processando = status === "detecting" || status === "searching";
  const totalFotos = resultados.reduce((total, resultado) => total + resultado.fotos.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <section className="mb-6 overflow-hidden rounded-3xl border border-[#2E7DD1]/15 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="p-6 lg:p-9">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2E7DD1]/15 bg-[#EFF5FF] px-3 py-1.5 text-xs font-bold text-[#1A4A80]">
              <Search size={13} /> Busca livre
            </span>
            <h1 className="text-2xl font-black text-[#0D2B4E] lg:text-4xl">Buscar qualquer pessoa por foto</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
              Use uma foto sua, de um amigo ou de uma amiga. Esta busca consulta o indice dos eventos e nao altera o rosto salvo no seu perfil.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#1A4A80]">
              <span className="rounded-full bg-[#EFF5FF] px-3 py-1.5">Foto nitida</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">Sem salvar no perfil</span>
              <Link href="/cadastrar-rosto" className="rounded-full border border-[#2E7DD1]/20 px-3 py-1.5 text-[#2E7DD1] hover:bg-[#EFF5FF]">
                Cadastrar meu rosto
              </Link>
            </div>
          </div>

          <div className="border-t border-[#2E7DD1]/10 bg-[#F5F9FF] p-5 lg:border-l lg:border-t-0 lg:p-7">
            {!preview ? (
              <div className="grid h-full min-h-72 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <button onClick={() => cameraRef.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2E7DD1]/35 bg-white text-[#0D2B4E] transition hover:border-[#2E7DD1] hover:bg-[#EFF5FF]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2167AE] text-white shadow"><Camera size={22} /></span>
                  <strong className="text-sm">Tirar foto</strong>
                </button>
                <button onClick={() => inputRef.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2E7DD1]/35 bg-white text-[#0D2B4E] transition hover:border-[#2E7DD1] hover:bg-[#EFF5FF]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2E7DD1] shadow"><ImageIcon size={22} /></span>
                  <strong className="text-sm">Escolher foto</strong>
                </button>
              </div>
            ) : (
              <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-[#2E7DD1]/15 bg-white p-5">
                <div className="relative">
                  <img src={preview} alt="Foto de referencia" className="h-40 w-40 rounded-full border-4 border-[#2E7DD1] object-cover shadow-lg" />
                  {!processando && (
                    <button onClick={() => { setPreview(null); setResultados([]); setStatus("idle"); }} className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow">
                      <X size={15} />
                    </button>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0D2B4E]">
                  <CheckCircle size={15} className="text-emerald-500" /> Foto pronta para procurar
                </p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#2E7DD1]/15 bg-[#EFF5FF] px-4 py-4 sm:flex-row sm:items-center">
        <Shield size={17} className="shrink-0 text-[#2E7DD1]" />
        <p className="flex-1 text-xs leading-5 text-[#1A4A80]">
          O vetor desta foto e usado nesta busca. Para receber o sininho quando voce aparecer em novos eventos, cadastre o seu proprio rosto no perfil.
        </p>
        <button onClick={buscarPessoa} disabled={!preview || processando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2167AE] px-5 text-sm font-bold text-white shadow transition hover:bg-[#19558F] disabled:cursor-not-allowed disabled:opacity-40">
          {processando ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
          {status === "detecting" ? "Lendo rosto..." : status === "searching" ? "Procurando..." : "Buscar pessoa"}
        </button>
      </div>

      {status === "error" && <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{erro}</p>}

      {status === "done" && totalFotos === 0 && (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="font-bold text-[#0D2B4E]">Nenhuma foto parecida apareceu no indice.</p>
          <p className="mt-1 text-sm text-gray-400">Tente outra foto com o rosto maior ou confirme se o evento ja foi indexado.</p>
        </div>
      )}

      {resultados.length > 0 && (
        <section className="space-y-5">
          <header>
            <h2 className="text-xl font-black text-[#0D2B4E]">{totalFotos} foto{totalFotos !== 1 ? "s" : ""} encontrada{totalFotos !== 1 ? "s" : ""}</h2>
            <p className="text-sm text-gray-500">Confira antes de baixar ou marcar como sua.</p>
          </header>
          {resultados.map(({ evento, fotos }) => (
            <div key={evento.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#0D2B4E]">{evento.nome}</h3>
                  <p className="text-xs text-gray-400">{fotos.length} resultado{fotos.length !== 1 ? "s" : ""} neste evento</p>
                </div>
                <Link href={`/eventos/${evento.id}`} className="text-sm font-bold text-[#2E7DD1] hover:underline">Abrir evento</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {fotos.slice(0, 12).map((foto) => (
                  <Link key={foto.fotoId} href={`/eventos/${evento.id}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#EFF5FF] shadow-sm">
                    <img src={`/api/thumb?id=${foto.fotoId}&sz=420`} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#0D2B4E]/80 px-2 py-1 text-[10px] font-bold text-white">Possivel match</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
