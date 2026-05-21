"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Camera, Download, ChevronRight, PartyPopper, AlertCircle } from "lucide-react";
import { fetchDescritores } from "@/lib/descritoresCache";

interface FotoMatch { id: string; distancia: number; }

function FotosConteudo() {
  const params     = useSearchParams();
  const token      = params.get("t") ?? "";

  const [estado,   setEstado]   = useState<"carregando"|"buscando"|"ok"|"erro"|"expirado">("carregando");
  const [fotos,    setFotos]    = useState<string[]>([]);
  const [evento,   setEvento]   = useState("");
  const [email,    setEmail]    = useState("");

  useEffect(() => {
    if (!token) { setEstado("erro"); return; }

    // Decodifica o token
    let decoded: { email: string; eventoSlug: string; ts: number };
    try {
      const json = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
      const obj  = JSON.parse(json);
      decoded    = { email: obj.e, eventoSlug: obj.s, ts: obj.t };
    } catch {
      setEstado("erro");
      return;
    }

    // Verifica expiração (7 dias)
    const seteDias = 7 * 24 * 60 * 60;
    if (Date.now() / 1000 - decoded.ts > seteDias) {
      setEstado("expirado");
      return;
    }

    setEmail(decoded.email);
    buscarFotos(decoded.email, decoded.eventoSlug);
  }, [token]);

  async function buscarFotos(emailUsuario: string, eventoSlug: string) {
    setEstado("buscando");

    try {
      // 1. Carrega descriptor do perfil
      const perfilRes = await fetch(`/api/perfil?email=${encodeURIComponent(emailUsuario)}`);
      const perfil    = perfilRes.ok ? await perfilRes.json() : null;
      if (!perfil?.descriptor) { setEstado("erro"); return; }

      // 2. Encontra evento
      const eventosRes = await fetch("/api/eventos");
      const eventos: { id: string; nome: string; folder_id: string }[] = await eventosRes.json();
      const ev = eventos.find(e => `${e.id}-${slugify(e.nome)}` === eventoSlug || e.id === eventoSlug);
      if (!ev) { setEstado("erro"); return; }
      setEvento(ev.nome);

      const meuDesc = new Float32Array(perfil.descriptor);

      // 3. ★ MODO RÁPIDO ★ — usa o índice pré-computado pelo admin (mesma fonte que /resultado)
      const idxData = await fetchDescritores(ev.id);
      if (idxData?.indexado && Array.isArray(idxData.dados) && idxData.dados.length > 0) {
        const LIMIAR = 0.60;   // mesmo limiar de /resultado pra consistência
        const matches: FotoMatch[] = [];
        for (const foto of idxData.dados) {
          let melhor = Infinity;
          for (const rosto of foto.rostos) {
            let soma = 0;
            for (let i = 0; i < meuDesc.length; i++) {
              const diff = meuDesc[i] - rosto.descriptor[i];
              soma += diff * diff;
            }
            const dist = Math.sqrt(soma);
            if (dist < melhor) melhor = dist;
          }
          if (melhor < LIMIAR) matches.push({ id: foto.fotoId, distancia: melhor });
        }
        matches.sort((a, b) => a.distancia - b.distancia);
        setFotos(matches.map(m => m.id));
        setEstado("ok");
        return;
      }

      // 4. Fallback: face-api ao vivo (raro — só se evento não foi indexado ainda)
      // Sem limite de 60 fotos — processa todas em lotes
      const fotosRes  = await fetch(`/api/fotos?folderId=${ev.folder_id}`);
      const { fotos: todasFotos }: { fotos: { id: string }[] } = await fotosRes.json();
      if (!todasFotos?.length) { setFotos([]); setEstado("ok"); return; }

      const { loadFaceModels, detectorOptions } = await import("@/lib/faceapi-loader");
      const faceapi = await loadFaceModels();

      const matches: FotoMatch[] = [];
      const lote = 5;
      for (let i = 0; i < todasFotos.length; i += lote) {
        const batch = todasFotos.slice(i, i + lote);
        await Promise.all(batch.map(async (foto) => {
          try {
            const img = await faceapi.fetchImage(`/api/thumb?id=${foto.id}&sz=600`);
            const dets = await faceapi
              .detectAllFaces(img, detectorOptions(faceapi, 0.5))
              .withFaceLandmarks(false)
              .withFaceDescriptors();

            for (const det of dets) {
              const dist = faceapi.euclideanDistance(meuDesc, det.descriptor);
              if (dist < 0.55) matches.push({ id: foto.id, distancia: dist });
            }
          } catch { /* foto com problema, ignora */ }
        }));
      }

      matches.sort((a, b) => a.distancia - b.distancia);
      setFotos(matches.map(m => m.id));
      setEstado("ok");
    } catch (e) {
      console.error(e);
      setEstado("erro");
    }
  }

  // ── Estados ──────────────────────────────────────────────
  if (estado === "carregando" || estado === "buscando") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg animate-pulse">
        <Camera size={28} className="text-white" />
      </div>
      <div>
        <p className="font-bold text-[#0D2B4E]">
          {estado === "carregando" ? "Abrindo seu link..." : "Buscando suas fotos..."}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {estado === "buscando" ? "Isso pode levar alguns segundos ☕" : ""}
        </p>
      </div>
      <Loader2 size={24} className="animate-spin text-[#2E7DD1]" />
    </div>
  );

  if (estado === "expirado") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={28} className="text-amber-500" />
      </div>
      <h2 className="text-xl font-black text-[#0D2B4E] mb-2">Link expirado</h2>
      <p className="text-gray-400 text-sm mb-6">Este link era válido por 7 dias. Cadastre seu rosto novamente para receber um novo link.</p>
      <Link href="/cadastrar-rosto" className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow">
        Buscar minhas fotos <ChevronRight size={14} />
      </Link>
    </div>
  );

  if (estado === "erro") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={28} className="text-red-400" />
      </div>
      <h2 className="text-xl font-black text-[#0D2B4E] mb-2">Link inválido</h2>
      <p className="text-gray-400 text-sm mb-6">Não conseguimos identificar seu link. Tente buscar suas fotos manualmente.</p>
      <Link href="/cadastrar-rosto" className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow">
        Buscar minhas fotos <ChevronRight size={14} />
      </Link>
    </div>
  );

  // ── Resultado ─────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
          <PartyPopper size={28} className="text-white" />
        </div>
        <h1 className="text-2xl lg:text-3xl font-black text-[#0D2B4E] mb-2">
          {fotos.length > 0 ? "Suas fotos encontradas!" : "Nenhuma foto encontrada"}
        </h1>
        {evento && (
          <p className="text-gray-400 text-sm">
            Evento: <span className="font-semibold text-[#0D2B4E]">{evento}</span>
            {fotos.length > 0 && <span className="ml-2 text-[#2E7DD1] font-semibold">{fotos.length} foto{fotos.length !== 1 ? "s" : ""}</span>}
          </p>
        )}
      </div>

      {fotos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Camera size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Não encontramos você nas fotos deste evento.</p>
          <Link href="/cadastrar-rosto" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl gradient-primary text-white font-bold text-sm shadow">
            Tentar com outra foto <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {/* Grid de fotos */}
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 mb-8">
            {fotos.map(id => (
              <div key={id} className="break-inside-avoid mb-3 group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <img
                  src={`/api/thumb?id=${id}&sz=600`}
                  alt=""
                  className="w-full h-auto block group-hover:scale-105 transition-transform duration-500"
                />
                {/* Overlay com download */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={`/api/download?id=${id}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#0D2B4E] text-xs font-bold shadow"
                    download>
                    <Download size={13} /> Baixar
                  </a>
                </div>
                {/* Watermark */}
                <img src="/logos/logo.png" alt=""
                  className="absolute bottom-2 right-2 h-4 pointer-events-none select-none"
                  style={{ filter: "invert(1)", mixBlendMode: "screen", opacity: 0.5 }} />
              </div>
            ))}
          </div>

          {/* Botão baixar todas */}
          <div className="text-center">
            <button
              onClick={async () => {
                const { baixarFotosZip } = await import("@/lib/download-zip");
                baixarFotosZip(fotos, evento);
              }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-bold shadow-lg hover:opacity-90 transition">
              <Download size={16} /> Baixar todas ({fotos.length} fotos)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function slugify(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function FotosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#2E7DD1]" />
      </div>
    }>
      <FotosConteudo />
    </Suspense>
  );
}
