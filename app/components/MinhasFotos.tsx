"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ScanFace, ChevronRight, Download, Loader2, Sparkles, X, Zap } from "lucide-react";
import Link from "next/link";
import {
  fetchMinhasFotos, lerCacheMinhasFotos, salvarCacheMinhasFotos,
  ouvirAtualizacoes, lerDescriptors, menorDistancia,
} from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";
import { lerRecognitionThresholdLocal } from "@/lib/recognition-thresholds";

interface FotoDescritores {
  fotoId: string;
  rostos: { descriptor: number[] }[];
}

/* ── Mini card ────────────────────────────────────────────── */
function MiniCard({ id }: { id: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer group">
      {!loaded && <div className="absolute inset-0 bg-[#1A4A80]/20 animate-pulse" />}
      <img
        src={`/api/thumb?id=${id}&sz=300`}
        alt=""
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 bg-[#0D2B4E]/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <a href={`/api/download?id=${id}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
          <Download size={16} className="text-white" />
        </a>
      </div>
    </div>
  );
}

const MAX_FOTOS = 30;

export default function MinhasFotos() {
  const { data: session } = useSession();

  const [email,        setEmail]        = useState<string | null>(null);
  const [primeiroNome, setPrimeiroNome] = useState("");
  const [fotos,        setFotos]        = useState<string[]>([]);
  const [eventoNome,   setEventoNome]   = useState("");
  const [fase,         setFase]         = useState<"idle"|"buscando"|"pronto"|"vazio">("idle");
  const [fechado,      setFechado]      = useState(false);
  const [usouIndice,   setUsouIndice]   = useState(false);

  /* ── Detecta usuário ── */
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setPrimeiroNome(session.user.name?.split(" ")[0] ?? "");
        return;
      }
      try {
        const raw = localStorage.getItem("usuario_simples");
        if (raw) {
          const u = JSON.parse(raw);
          if (u?.email) { setEmail(u.email); setPrimeiroNome(u.nome?.split(" ")[0] ?? ""); }
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(id);
  }, [session]);

  const aplicarDados = useCallback((email: string, porEvento: { eventoId: string; eventoNome: string; fotos: string[] }[]) => {
    const todasFotos: string[] = [];
    const nomes: string[] = [];
    for (const ev of porEvento) {
      for (const id of ev.fotos) if (!todasFotos.includes(id)) todasFotos.push(id);
      nomes.push(ev.eventoNome);
    }
    const label = nomes.length === 1 ? nomes[0] : `${nomes.length} eventos`;
    setFotos(todasFotos.slice(0, MAX_FOTOS));
    setEventoNome(label);
    setUsouIndice(true);
    setFase("pronto");
    void email;
  }, []);

  const carregar = useCallback(async (userEmail: string) => {
    // 1. Render imediato com cache local (se houver)
    const cached = lerCacheMinhasFotos(userEmail);
    if (cached?.porEvento?.length) {
      aplicarDados(userEmail, cached.porEvento);
    }

    // 2. Fonte de verdade: Drive
    const fresh = await fetchMinhasFotos(userEmail);
    if (fresh?.porEvento?.length) {
      aplicarDados(userEmail, fresh.porEvento);
      return;
    }

    // 3. Sem dados no Drive nem cache → tenta matching local via descriptor
    if (!cached?.porEvento?.length) {
      await rodarMatchingLocal(userEmail);
    } else {
      // Tinha cache mas Drive vazio — mantém cache
      setFase("pronto");
    }
  }, [aplicarDados]);

  /* ── Re-fetch automático quando outra página atualiza ── */
  useEffect(() => {
    if (!email) return;
    const id = window.setTimeout(() => {
      void carregar(email);
    }, 0);
    const pararAtualizacoes = ouvirAtualizacoes(() => { if (email) carregar(email); });
    return () => {
      window.clearTimeout(id);
      pararAtualizacoes();
    };
  }, [email, carregar]);

  async function rodarMatchingLocal(userEmail: string) {
    setFase("buscando");
    try {
      let descriptors = lerDescriptors();
      if (descriptors.length === 0) {
        // Busca descriptors no perfil (multi-selfie) com fallback pro legado
        const perfilRes = await fetch(`/api/perfil?email=${encodeURIComponent(userEmail)}`);
        if (!perfilRes.ok) { setFase("vazio"); return; }
        const perfil = await perfilRes.json();
        const fromServer: number[][] = Array.isArray(perfil?.descriptors) && perfil.descriptors.length > 0
          ? perfil.descriptors
          : Array.isArray(perfil?.descriptor) && perfil.descriptor.length === 128
          ? [perfil.descriptor]
          : [];
        if (fromServer.length === 0) { setFase("vazio"); return; }
        descriptors = fromServer.map(d => new Float32Array(d));
      }
      return matchingComDescriptor(userEmail, descriptors);
    } catch (e) {
      console.error("[MinhasFotos] erro no matching:", e);
      setFase("vazio");
    }
  }

  async function matchingComDescriptor(userEmail: string, descriptors: Float32Array[]) {
    const eventosRaw = await fetch("/api/eventos").then(r => r.json()).catch(() => []);
    type EvMin = { folder_id?: string; total_fotos: number; id: string; nome: string };
    const ativos = (eventosRaw as EvMin[]).filter(e => e.folder_id && e.total_fotos > 0);
    if (!ativos.length) { setFase("vazio"); return; }

    const porEvento: { eventoId: string; eventoNome: string; fotos: string[] }[] = [];
    const todasFotos: string[] = [];
    const limiar = lerRecognitionThresholdLocal("usuario");

    await Promise.all(ativos.map(async (ev) => {
      const json = await fetchDescritores(ev.id);
      if (!json?.indexado || !Array.isArray(json.dados) || json.dados.length === 0) return;

      const fotosEv: string[] = [];
      for (const fotoDesc of json.dados as FotoDescritores[]) {
        let melhor = Infinity;
        for (const rosto of fotoDesc.rostos) {
          const d = menorDistancia(descriptors, rosto.descriptor);
          if (d < melhor) melhor = d;
        }
        if (melhor < limiar) fotosEv.push(fotoDesc.fotoId);
      }
      if (fotosEv.length) {
        porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: fotosEv });
        for (const id of fotosEv) if (!todasFotos.includes(id)) todasFotos.push(id);
        aplicarDados(userEmail, [...porEvento]);
      }
    }));

    if (!todasFotos.length) {
      salvarCacheMinhasFotos(userEmail, { matches: [], porEvento: [] });
      setFase("vazio");
      return;
    }

    salvarCacheMinhasFotos(userEmail, {
      matches: todasFotos.map(id => ({ id, distancia: 0.5 })),
      porEvento,
    });
    aplicarDados(userEmail, porEvento);
  }

  // Esconde enquanto não há dados nem está buscando (evita flash de "0 fotos suas")
  if (!email || fase === "vazio" || fase === "idle" || fechado) return null;

  return (
    <section
      className="mx-0 rounded-2xl overflow-hidden border shadow-sm relative"
      style={{ background: "linear-gradient(135deg,#EFF5FF 0%,#E4EFFE 100%)", borderColor: "rgba(46,125,209,0.18)" }}
    >
      <button onClick={() => setFechado(true)}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#2E7DD1]/10 hover:text-[#2E7DD1] transition z-10"
        title="Fechar">
        <X size={14} />
      </button>

      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[#2E7DD1]/10">
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow shrink-0">
          <ScanFace size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {fase === "buscando" ? (
            <>
              <p className="font-bold text-[#0D2B4E] text-sm flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin text-[#2E7DD1]" /> Procurando suas fotos...
              </p>
              <p className="text-gray-400 text-xs mt-0.5">Analisando com IA — só um momento</p>
            </>
          ) : (
            <>
              <p className="font-bold text-[#0D2B4E] text-sm flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#2E7DD1]" />
                Acho que é você{primeiroNome ? `, ${primeiroNome}` : ""}! 🤔
                {usouIndice && <Zap size={11} className="text-yellow-500 ml-0.5" />}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {eventoNome} · {fotos.length} possível{fotos.length !== 1 ? "is" : ""} foto{fotos.length !== 1 ? "s" : ""} sua{fotos.length !== 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-amber-600/80 mt-1">
                💡 IA pode confundir — confirme em <strong>São minhas</strong>.
              </p>
            </>
          )}
        </div>
        {fase === "pronto" && (
          <Link href="/resultado"
            className="flex items-center gap-1 text-[#2E7DD1] text-xs font-bold hover:underline shrink-0 mr-6">
            Ver todas <ChevronRight size={13} />
          </Link>
        )}
      </div>

      <div className="px-5 py-4">
        {fase === "buscando" ? (
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-[#1A4A80]/10 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {fotos.map(id => <MiniCard key={id} id={id} />)}
            <Link href="/resultado"
              className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl border-2 border-dashed border-[#2E7DD1]/35 flex flex-col items-center justify-center gap-1.5 text-[#2E7DD1] hover:bg-[#2E7DD1]/6 transition group">
              <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform" />
              <span className="text-xs font-semibold">Ver todas</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
