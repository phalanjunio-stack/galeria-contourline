"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Heart, Share2, Camera, ArrowLeft, ScanFace, Check, Square, CheckSquare, X, Loader2, Zap, UserCheck } from "lucide-react";
import Link from "next/link";
import type { EventoItem } from "@/app/api/eventos/route";
// Tipo local (evita importar de rota de API em componente client)
interface FotoDescritores {
  fotoId: string;
  rostos: { descriptor: number[] }[];
}
import GaleriaLoading from "@/app/components/GaleriaLoading";
import { baixarComoZip } from "@/lib/download-zip";
import {
  fetchMinhasFotos, lerCacheMinhasFotos, salvarCacheMinhasFotos,
  notificarAtualizacao, lerDescriptor, lerDescriptors, menorDistancia,
} from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";
import { autoIndexarEventos } from "@/lib/autoIndexar";
import type { MinhasFotosEvento } from "@/lib/minhasFotos";
import { toggleFavorito, isFavorito } from "@/app/(public)/favoritos/page";
import {
  DEFAULT_RECOGNITION_THRESHOLDS,
  lerRecognitionThresholdLocal,
} from "@/lib/recognition-thresholds";

interface Foto  { id: string; name: string; }
interface Match { foto: Foto; distancia: number; modoRapido?: boolean; }

/** Distância euclidiana pura (sem face-api) */
function distancia(a: Float32Array, b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function FotoCard({
  match, selecionada, modoSelecao, onToggleSel,
}: {
  match: Match; selecionada: boolean; modoSelecao: boolean; onToggleSel: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [fav, setFav]       = useState(() => isFavorito(match.foto.id));
  const badge = match.distancia < 0.45 ? "Alta chance" : "Talvez você";
  const cor   = match.distancia < 0.45 ? "bg-emerald-500/90" : "bg-amber-500/90";

  return (
    <div
      onClick={modoSelecao ? onToggleSel : undefined}
      className={`group relative aspect-square rounded-xl overflow-hidden shadow hover:shadow-lg transition cursor-pointer
        ${selecionada ? "ring-[3px] ring-[#2E7DD1] ring-offset-2 scale-[0.97]" : ""}`}
    >
      {!loaded && <div className="absolute inset-0 bg-gradient-to-br from-[#1A4A80]/30 to-[#2E7DD1]/30 animate-pulse" />}
      <img src={`/api/thumb?id=${match.foto.id}&sz=40`} alt="" aria-hidden
        className={`absolute inset-0 w-full h-full object-cover scale-110 blur-lg transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`} />
      <img src={`/api/thumb?id=${match.foto.id}&sz=400`} alt={match.foto.name}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} />

      {/* Badge distância */}
      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white z-10 ${cor}`}>
        {badge}
      </div>
      {/* Badge modo rápido */}
      {match.modoRapido && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full z-10">
          <Zap size={9} className="text-yellow-300" />
          <span className="text-[9px] text-white font-semibold">Índice</span>
        </div>
      )}

      {/* Checkbox modo seleção */}
      {modoSelecao && (
        <div className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center shadow-md z-10 transition-all
          ${selecionada ? "gradient-primary scale-110" : "bg-white/90 border border-gray-300"}`}>
          {selecionada && <Check size={13} className="text-white" strokeWidth={3} />}
        </div>
      )}
      {modoSelecao && selecionada && (
        <div className="absolute inset-0 bg-[#2E7DD1]/25 pointer-events-none z-10" />
      )}

      {/* Hover overlay */}
      {!modoSelecao && (
        <div className="absolute inset-0 bg-[#0D2B4E]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
          <button onClick={(e) => { e.stopPropagation(); const novo = toggleFavorito(match.foto.id); setFav(novo); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${fav ? "bg-red-500" : "bg-white/20 hover:bg-white/40"}`}>
            <Heart size={16} className="text-white" fill={fav ? "white" : "none"} />
          </button>
          <a href={`/api/download?id=${match.foto.id}`} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
            <Download size={16} className="text-white" />
          </a>
          <button onClick={(e) => { e.stopPropagation(); onToggleSel(); }}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
            <CheckSquare size={16} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function getEmailLocal(): string {
  try { return JSON.parse(localStorage.getItem("usuario_simples") ?? "{}").email ?? ""; } catch { return ""; }
}

function getNomeLocal(): string {
  try { return JSON.parse(localStorage.getItem("usuario_simples") ?? "{}").nome ?? ""; } catch { return ""; }
}

async function notificarSeNovo(email: string, nome: string, totalFotos: number, eventoNome: string) {
  if (!email || totalFotos === 0) return;
  const chave = `notif_resultado_${email}`;
  try {
    const ultimo = parseInt(localStorage.getItem(chave) ?? "0");
    if (totalFotos <= ultimo) return; // não tem fotos novas desde a última notificação
    localStorage.setItem(chave, String(totalFotos));
  } catch { return; }
  try {
    await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        tipo: "fotos_encontradas",
        titulo: `Encontramos ${totalFotos} foto${totalFotos !== 1 ? "s" : ""} suas! 📸`,
        mensagem: `${nome ? `Olá, ${nome.split(" ")[0]}! ` : ""}Você aparece em ${eventoNome}.`,
        link: "/resultado",
      }),
    });
  } catch { /* ignora */ }
}

export default function ResultadoPage() {
  const router = useRouter();
  const [evento,          setEvento]          = useState<EventoItem | null>(null);
  const [eventosCount,    setEventosCount]    = useState(0);   // eventos indexados pesquisados
  const [porEvento,       setPorEvento]       = useState<MinhasFotosEvento[]>([]);
  const [matches,      setMatches]      = useState<Match[]>([]);
  const [progress,     setProgress]     = useState(0);
  const [total,        setTotal]        = useState(0);
  const [fase,         setFase]         = useState<"init"|"buscando"|"comparando"|"done"|"sem-rosto">("init");
  const [modoRapido,   setModoRapido]   = useState(false);
  const [selecionadas,   setSelecionadas]   = useState<Set<string>>(new Set());
  const [modoSelecao,    setModoSelecao]    = useState(false);
  const [baixando,       setBaixando]       = useState(false);
  const [confirmando,    setConfirmando]    = useState(false);
  const [confirmado,     setConfirmado]     = useState(false);
  const [debug,          setDebug]          = useState<{ totalEventos: number; eventosIndexados: number; fotosAnalisadas: number; melhorDistancia: number | null; limiar: number; eventosComMatch: number; emailUsado: string; eventosConsultados: { id: string; nome: string; temMatches: boolean; emailsNoMatches: string[] }[] }>({
    totalEventos: 0, eventosIndexados: 0, fotosAnalisadas: 0, melhorDistancia: null, limiar: DEFAULT_RECOGNITION_THRESHOLDS.resultado,
    eventosComMatch: 0, emailUsado: "", eventosConsultados: [],
  });

  useEffect(() => {
    async function run() {
      const emailUsuario = getEmailLocal();

      // ── 1. Render imediato via cache local (se houver) ────────
      if (emailUsuario) {
        const cached = lerCacheMinhasFotos(emailUsuario);
        if (cached?.matches?.length) {
          setMatches(cached.matches.map(m => ({
            foto: { id: m.id, name: m.id },
            distancia: m.distancia,
            modoRapido: true,
          })));
          setPorEvento(cached.porEvento);
          setEventosCount(cached.porEvento.length);
          setModoRapido(true);
          setFase("done");
        }
      }

      // ── 2. Fonte de verdade: Drive (_mf_{email}.json) ─────────
      if (emailUsuario) {
        const fresh = await fetchMinhasFotos(emailUsuario);
        if (fresh?.matches?.length) {
          setMatches(fresh.matches.map(m => ({
            foto: { id: m.id, name: m.id },
            distancia: m.distancia,
            modoRapido: true,
          })));
          setPorEvento(fresh.porEvento);
          setEventosCount(fresh.porEvento.length);
          setModoRapido(true);
          setFase("done");
          const nomeLocal = getNomeLocal();
          const labelEv = fresh.porEvento.length === 1 ? fresh.porEvento[0].eventoNome : `${fresh.porEvento.length} eventos`;
          notificarSeNovo(emailUsuario, nomeLocal, fresh.matches.length, labelEv);
          return; // admin já verificou — não precisa rodar face-api
        }
      }

      // ★ FONTE PRIMÁRIA: matches do admin ★
      // _matches_{eventoId}.json é gerado pelo admin durante a indexação.
      // É a "verdade absoluta" — se admin achou você, aparece aqui.
      if (emailUsuario) {
        try {
          const evRes2 = await fetch("/api/eventos");
          const lista2: EventoItem[] = await evRes2.json();
          const ativos2 = (Array.isArray(lista2) ? lista2 : []).filter(e => e.folder_id);
          const emailNorm = emailUsuario.toLowerCase().trim();
          const foundAdmin: Match[] = [];
          const porEventoAdmin: MinhasFotosEvento[] = [];
          const diagEventos: { id: string; nome: string; temMatches: boolean; emailsNoMatches: string[] }[] = [];

          await Promise.all(ativos2.map(async (ev) => {
            const r = await fetch(`/api/matches?eventoId=${ev.id}`).catch(() => null);
            if (!r?.ok) {
              diagEventos.push({ id: ev.id, nome: ev.nome, temMatches: false, emailsNoMatches: [] });
              return;
            }
            const data = await r.json();
            if (!Array.isArray(data?.usuarios)) {
              diagEventos.push({ id: ev.id, nome: ev.nome, temMatches: false, emailsNoMatches: [] });
              return;
            }
            const emails = (data.usuarios as { email: string }[]).map(u => u.email);
            diagEventos.push({ id: ev.id, nome: ev.nome, temMatches: true, emailsNoMatches: emails });
            const eu = data.usuarios.find((u: { email: string; fotosIds: string[] }) =>
              (u.email ?? "").toLowerCase().trim() === emailNorm
            );
            if (eu?.fotosIds?.length) {
              porEventoAdmin.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: eu.fotosIds });
              for (const id of eu.fotosIds) {
                if (!foundAdmin.some(m => m.foto.id === id)) {
                  foundAdmin.push({ foto: { id, name: id }, distancia: 0.3, modoRapido: true });
                }
              }
            }
          }));

          // Guarda diagnóstico mesmo se foundAdmin.length === 0 (pra mostrar no painel)
          setDebug(d => ({
            ...d,
            totalEventos: ativos2.length,
            eventosComMatch: porEventoAdmin.length,
            emailUsado: emailNorm,
            eventosConsultados: diagEventos,
          }));

          if (foundAdmin.length > 0) {
            setMatches(foundAdmin);
            setPorEvento(porEventoAdmin);
            setEventosCount(porEventoAdmin.length);
            setModoRapido(true);
            setFase("done");
            // NÃO cacheamos aqui — esses são "candidatos" da IA, não confirmação do usuário.
            // /minhas-fotos só deve mostrar o que foi confirmado via "São minhas".
            return; // resolveu via admin matches — não precisa rodar descritor
          }
        } catch { /* fallback abaixo */ }
      }

      // ── 3. Combina descriptors local (rápido) + servidor (autoritativo) ────
      const descriptors = lerDescriptors();
      // Busca do servidor pra garantir que matches do admin batem
      if (emailUsuario) {
        try {
          const r = await fetch(`/api/perfil?email=${encodeURIComponent(emailUsuario)}`);
          if (r.ok) {
            const p = await r.json();
            const fromServer: number[][] = Array.isArray(p?.descriptors) && p.descriptors.length > 0
              ? p.descriptors
              : Array.isArray(p?.descriptor) && p.descriptor.length === 128
              ? [p.descriptor]
              : [];
            // Adiciona descriptors do servidor que ainda não estão localmente (dedup por 1ª dimensão)
            for (const d of fromServer) {
              const f = new Float32Array(d);
              const dup = descriptors.some(local => Math.abs(local[0] - f[0]) < 0.0001 && Math.abs(local[1] - f[1]) < 0.0001);
              if (!dup) descriptors.push(f);
            }
          }
        } catch { /* segue só com local */ }
      }
      if (descriptors.length === 0) {
        if (!matches.length) setFase("sem-rosto");
        return;
      }
      const descriptor = descriptors[0];
      void descriptor;

      setFase("buscando");
      const evRes  = await fetch("/api/eventos");
      const lista: EventoItem[] = await evRes.json();
      // Todos os eventos com pasta válida
      const ativos = lista.filter(e => e.folder_id);
      if (!ativos.length) { setFase("done"); return; }

      // Resultado final usa rosto individual. Cluster inteiro pode incluir
      // gente parecida demais para ser mostrado como foto do usuario.
      const descriptorsArr = descriptors.map(f => Array.from(f));
      const limiarResultado = lerRecognitionThresholdLocal("resultado");
      const matchesViaPgvector = new Map<string, { ev: EventoItem; fotos: Map<string, number> }>();

      try {
        const buscaRes = await fetch("/api/pessoas/buscar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventoIds: ativos.map(e => e.id),
            descriptors: descriptorsArr,
            threshold: limiarResultado,
          }),
        });
        const buscaData = buscaRes.ok ? await buscaRes.json() : null;
        if (Array.isArray(buscaData?.matches)) {
          for (const match of buscaData.matches as { eventoId: string; fotoId: string; dist: number }[]) {
            const ev = ativos.find(e => e.id === match.eventoId);
            const dist = Number(match.dist);
            if (!ev || typeof match.fotoId !== "string" || !Number.isFinite(dist)) continue;
            const anterior = matchesViaPgvector.get(ev.id);
            const fotos = anterior?.fotos ?? new Map<string, number>();
            const distAnterior = fotos.get(match.fotoId);
            if (distAnterior === undefined || dist < distAnterior) fotos.set(match.fotoId, dist);
            matchesViaPgvector.set(ev.id, { ev, fotos });
          }
        }
      } catch { /* fallback abaixo */ }

      // ── Eventos com índice (vai pro fallback de descritores soltos pros que não tem cluster) ──
      const indexados: { ev: EventoItem; dados: FotoDescritores[] }[] = [];
      const naoIndexados: EventoItem[] = [];
      for (const ev of ativos) {
        if (matchesViaPgvector.has(ev.id)) continue; // ja resolvido foto a foto no banco
        const idxJson = await fetchDescritores(ev.id);
        if (idxJson?.indexado && Array.isArray(idxJson.dados) && idxJson.dados.length > 0) {
          indexados.push({ ev, dados: idxJson.dados });
        } else {
          naoIndexados.push(ev);
        }
      }

      // ★ AUTO-INDEXAÇÃO: dispara indexação em background dos eventos sem índice.
      // Roda em paralelo, NÃO bloqueia a busca atual. StatusDock mostra o progresso.
      if (naoIndexados.length > 0) {
        autoIndexarEventos(naoIndexados.map(e => ({
          id: e.id,
          nome: e.nome,
          folder_id: e.folder_id,
        }))).then((r) => {
          if (r.disparados > 0) {
            console.log(`[auto-indexar] ${r.disparados} eventos disparados em background`);
          }
        }).catch(() => {});
      }

      const foundPgvector: Match[] = [];
      const porEventoPgvector: MinhasFotosEvento[] = [];
      for (const { ev, fotos } of matchesViaPgvector.values()) {
        const fotosArr = [...fotos.entries()].sort((a, b) => a[1] - b[1]);
        for (const [id, dist] of fotosArr) {
          foundPgvector.push({ foto: { id, name: id }, distancia: dist, modoRapido: true });
        }
        porEventoPgvector.push({
          eventoId: ev.id,
          eventoNome: ev.nome,
          fotos: fotosArr.map(([id]) => id),
        });
      }

      // Se TUDO foi resolvido via pgvector (caminho rapido), salva e retorna.
      if (foundPgvector.length > 0 && indexados.length === 0) {
        foundPgvector.sort((a, b) => a.distancia - b.distancia);
        setDebug(prev => ({
          ...prev,
          totalEventos: ativos.length,
          eventosIndexados: matchesViaPgvector.size,
          fotosAnalisadas: foundPgvector.length,
          melhorDistancia: foundPgvector[0]?.distancia ?? null,
          limiar: limiarResultado,
        }));
        setEventosCount(matchesViaPgvector.size);
        if (matchesViaPgvector.size === 1) setEvento([...matchesViaPgvector.values()][0].ev);
        setModoRapido(true);
        setMatches(foundPgvector);
        setPorEvento(porEventoPgvector);
        setFase("done");
        // Nao cacheamos: candidatos da IA, nao confirmacao do usuario.
        return;
      }

      if (indexados.length > 0) {
        // ★ MODO RÁPIDO — busca em TODOS os eventos indexados ★
        const eventosComparados = new Set([
          ...porEventoPgvector.map(ev => ev.eventoId),
          ...indexados.map(({ ev }) => ev.id),
        ]);
        setEventosCount(eventosComparados.size);
        if (eventosComparados.size === 1) {
          setEvento(porEventoPgvector[0]
            ? ativos.find(ev => ev.id === porEventoPgvector[0].eventoId) ?? null
            : indexados[0].ev);
        }
        setModoRapido(true);
        setFase("comparando");
        const totalFotos = indexados.reduce((s, e) => s + e.dados.length, 0);
        setTotal(totalFotos);

        const LIMIAR = limiarResultado;
        const found: Match[] = [...foundPgvector];
        const porEvento: MinhasFotosEvento[] = [...porEventoPgvector];
        let done = 0;
        let melhorGlobal = foundPgvector[0]?.distancia ?? Infinity;

        for (const { ev, dados } of indexados) {
          const fotosEvento: string[] = [];
          for (const fotoDesc of dados) {
            // Compara CADA rosto da foto com TODOS descriptors do usuário,
            // pega a menor distância → mais chance de bater com multi-selfie
            let melhor = Infinity;
            for (const rosto of fotoDesc.rostos) {
              const d = menorDistancia(descriptors, rosto.descriptor);
              if (d < melhor) melhor = d;
            }
            if (melhor < melhorGlobal) melhorGlobal = melhor;
            if (melhor < LIMIAR) {
              found.push({ foto: { id: fotoDesc.fotoId, name: fotoDesc.fotoId }, distancia: melhor, modoRapido: true });
              fotosEvento.push(fotoDesc.fotoId);
            }
            done++;
            setProgress(done);
          }
          if (fotosEvento.length) {
            porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: fotosEvento });
          }
        }

        setDebug(prev => ({
          ...prev,
          totalEventos: ativos.length,
          eventosIndexados: indexados.length,
          fotosAnalisadas: totalFotos,
          melhorDistancia: melhorGlobal === Infinity ? null : melhorGlobal,
          limiar: LIMIAR,
        }));

        // Atualiza o LIMIAR no estado debug default (era 0.60)
        // só pra UI mostrar valor correto no cenário sem matches

        found.sort((a, b) => a.distancia - b.distancia);
        setMatches(found);
        setPorEvento(porEvento);
        setFase("done");

        const emailIdx = getEmailLocal();
        if (emailIdx && found.length > 0) {
          const nomeIdx = getNomeLocal();
          const labelIdx = porEvento.length === 1 ? porEvento[0].eventoNome : `${porEvento.length} eventos`;
          notificarSeNovo(emailIdx, nomeIdx, found.length, labelIdx);
        }

        // ── Salva no cache para aparecer em todas as páginas ──
        // NÃO cacheamos: candidatos da IA via descritor, não confirmação do usuário
        return;
      }

      // ── Fallback: IA em tempo real (nenhum evento indexado ainda) ─
      // Usa apenas o primeiro evento para não travar o browser
      setModoRapido(false);
      const ev = ativos.find(e => e.total_fotos > 0) ?? ativos[0];
      setEvento(ev);

      let fotos: Foto[] = [];
      if (ev.folder_id) {
        const cacheKey = `fotos_${ev.folder_id}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) fotos = JSON.parse(cached).fotos;
        } catch { /**/ }
        if (!fotos.length) {
          const fRes  = await fetch(`/api/fotos?folderId=${ev.folder_id}`);
          const fData = await fRes.json();
          fotos = fData.fotos ?? [];
          try { localStorage.setItem(cacheKey, JSON.stringify({ fotos })); } catch {}
        }
      }

      fotos = fotos.filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i).slice(0, 80);
      if (!fotos.length) { setFase("done"); return; }

      setFase("comparando");
      setTotal(fotos.length);

      const { loadFaceModels, detectorOptions } = await import("@/lib/faceapi-loader");
      const faceapi = await loadFaceModels();

      const LIMIAR = limiarResultado;
      const LOTE   = 8;

      for (let i = 0; i < fotos.length; i += LOTE) {
        const lote = fotos.slice(i, i + LOTE);
        await Promise.all(lote.map(async (foto) => {
          try {
            const img = await faceapi.fetchImage(`/api/thumb?id=${foto.id}&sz=600`);
            const detections = await faceapi
              .detectAllFaces(img, detectorOptions(faceapi, 0.5))
              .withFaceLandmarks(false)
              .withFaceDescriptors();
            if (!detections.length) return;
            const melhor = detections.reduce((min, det) => {
              const d = faceapi.euclideanDistance(descriptor, det.descriptor);
              return d < min ? d : min;
            }, Infinity);
            if (melhor < LIMIAR) {
              setMatches(prev => {
                if (prev.some(m => m.foto.id === foto.id)) return prev;
                return [...prev, { foto, distancia: melhor }].sort((a, b) => a.distancia - b.distancia);
              });
            }
          } catch { /**/ }
        }));
        setProgress(Math.min(i + LOTE, fotos.length));
      }
      setFase("done");
    }
    run();
  }, []);

  function toggleSel(id: string) {
    setSelecionadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    if (!modoSelecao) setModoSelecao(true);
  }
  function selecionarTodas() {
    const todos = matches.map(m => m.foto.id);
    setSelecionadas(selecionadas.size === todos.length ? new Set() : new Set(todos));
  }
  async function baixarSelecionadas() {
    setBaixando(true);
    await baixarComoZip(Array.from(selecionadas), "minhas-fotos-contourline.zip");
    setBaixando(false);
  }

  async function confirmarMinhasFotos() {
    if (selecionadas.size === 0 || confirmando) return;
    setConfirmando(true);
    const ids = Array.from(selecionadas);

    // Reconstrói porEvento apenas com as fotos confirmadas
    const novoPorEvento: MinhasFotosEvento[] = porEvento
      .map(ev => ({ ...ev, fotos: ev.fotos.filter(id => ids.includes(id)) }))
      .filter(ev => ev.fotos.length > 0);

    const email = getEmailLocal();
    const nome  = getNomeLocal();

    // Salva no cache local (atualiza todas as páginas via evento)
    if (email) {
      salvarCacheMinhasFotos(email, {
        matches: ids.map(id => ({ id, distancia: matches.find(m => m.foto.id === id)?.distancia ?? 0.3 })),
        porEvento: novoPorEvento,
      });
    }

    // Persiste no Drive (fonte de verdade) — MERGE com fotos já confirmadas
    if (email) {
      const processadoEm = new Date().toISOString();
      const resultados = await Promise.all(novoPorEvento.map(async ev => {
        try {
          const res = await fetch("/api/meu/fotos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              eventoId: ev.eventoId,
              eventoNome: ev.eventoNome,
              fotoIds: ev.fotos,
              processadoEm,
              merge: true,           // soma com fotos já confirmadas, sem duplicar
            }),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => res.statusText);
            return { ok: false, evento: ev.eventoNome, status: res.status, erro: txt };
          }
          return { ok: true, evento: ev.eventoNome };
        } catch (e) {
          return { ok: false, evento: ev.eventoNome, erro: String(e) };
        }
      }));
      const falhas = resultados.filter(r => !r.ok);
      if (falhas.length > 0) {
        console.error("[São minhas] PUT falhou para alguns eventos:", falhas);
        alert(`Erro ao salvar em ${falhas.length} evento(s):\n${falhas.map(f => `- ${f.evento}: ${f.erro ?? "?"} (HTTP ${f.status ?? "?"})`).join("\n")}`);
        setConfirmando(false);
        return; // não marca como confirmado se falhou
      }
      // ★ AUTO-APRENDIZADO ★
      // Cada foto confirmada tem rostos detectados no _desc_*.json.
      // Identifica qual rosto na foto É o usuário (menor dist das selfies atuais)
      // e adiciona esses descritores ao perfil → IA aprende com o tempo.
      try {
        const descritoresAtuais = lerDescriptors();
        if (descritoresAtuais.length > 0) {
          const novosDescriptors: number[][] = [];
          const MAX_TOTAL = 15;
          const orcamento = MAX_TOTAL - descritoresAtuais.length;

          if (orcamento > 0) {
            for (const ev of novoPorEvento) {
              if (novosDescriptors.length >= orcamento) break;
              const idx = await fetchDescritores(ev.eventoId);
              if (!idx?.indexado || !Array.isArray(idx.dados)) continue;
              for (const fotoId of ev.fotos) {
                if (novosDescriptors.length >= orcamento) break;
                const foto = idx.dados.find(f => f.fotoId === fotoId);
                if (!foto?.rostos?.length) continue;
                // Acha o rosto da foto que é MAIS PRÓXIMO das selfies atuais
                let melhorRosto: { descriptor: number[] } | null = null;
                let melhorDist = Infinity;
                for (const rosto of foto.rostos) {
                  const d = menorDistancia(descritoresAtuais, rosto.descriptor);
                  if (d < melhorDist) { melhorDist = d; melhorRosto = rosto; }
                }
                // Só aceita se for plausível (dist < 0.65 — confirmado pelo usuário, deve bater)
                if (melhorRosto && melhorDist < 0.65) {
                  // Evita duplicar descritores muito parecidos com os existentes
                  const jaTem = novosDescriptors.some(d =>
                    Math.abs(d[0] - melhorRosto!.descriptor[0]) < 0.001 &&
                    Math.abs(d[1] - melhorRosto!.descriptor[1]) < 0.001
                  );
                  if (!jaTem) novosDescriptors.push(melhorRosto.descriptor);
                }
              }
            }
          }

          if (novosDescriptors.length > 0 && email) {
            // POST descriptors_add no perfil — vai mesclar com os existentes.
            // Pra usuário simples (sem sessão Google), manda email_simples + nome_simples
            // pra API identificar.
            const body: Record<string, unknown> = { descriptors_add: novosDescriptors };
            // Se não tiver sessão Google, ident via email_simples
            body.email_simples = email;
            if (nome) body.nome_simples = nome;
            await fetch("/api/perfil", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => { /* falha do auto-treino é silenciosa, não bloqueia o "São minhas" */ });
            console.log(`[Auto-treino] +${novosDescriptors.length} descritor(es) adicionado(s) ao perfil — IA vai melhorar nos próximos eventos.`);
          }
        }
      } catch (e) {
        console.warn("[Auto-treino] falhou (não-fatal):", e);
      }

      // Re-busca do Drive pra UI refletir o conjunto mesclado
      const fresh = await fetchMinhasFotos(email);
      if (fresh) {
        setMatches(fresh.matches.map(m => ({
          foto: { id: m.id, name: m.id },
          distancia: m.distancia,
          modoRapido: true,
        })));
        setPorEvento(fresh.porEvento);
      }
      // Dispara nova busca pra todos os componentes refletirem a versão do Drive
      notificarAtualizacao();
    }

    // Atualiza o estado local para refletir só as confirmadas
    setMatches(prev => prev.filter(m => ids.includes(m.foto.id)));
    setPorEvento(novoPorEvento);
    setSelecionadas(new Set());
    setModoSelecao(false);
    setConfirmando(false);
    setConfirmado(true);

    if (email && novoPorEvento.length > 0) {
      const label = novoPorEvento.length === 1 ? novoPorEvento[0].eventoNome : `${novoPorEvento.length} eventos`;
      notificarSeNovo(email, nome, ids.length, label);
    }

    // Volta para a home após 1.5s — o banner MinhasFotos já terá os dados confirmados
    setTimeout(() => router.push("/?fotos=confirmadas"), 1500);
  }

  // Ativa seleção automaticamente ao encontrar fotos (para o usuário saber que pode selecionar)
  useEffect(() => {
    if (fase === "done" && matches.length > 0 && !confirmado) {
      setModoSelecao(true);
    }
  }, [fase, matches.length, confirmado]);

  const alta    = matches.filter(m => m.distancia < 0.45);
  const talvez  = matches.filter(m => m.distancia >= 0.45);
  const todasSel = selecionadas.size === matches.length && matches.length > 0;
  const pct     = total > 0 ? Math.round((progress / total) * 100) : 0;

  if (fase === "init" || fase === "buscando")
    return <GaleriaLoading label="Buscando evento..." />;

  if (fase === "comparando") {
    return (
      <GaleriaLoading
        progresso={pct}
        label={modoRapido
          ? `Comparando com índice... (${progress}/${total})`
          : "Analisando rostos com IA..."}
      />
    );
  }

  if (fase === "sem-rosto") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <ScanFace size={48} className="text-gray-300" />
      <p className="font-semibold text-[#0D2B4E]">Nenhuma selfie encontrada</p>
      <p className="text-gray-400 text-sm">Faça o cadastro do seu rosto primeiro.</p>
      <Link href="/cadastrar-rosto" className="mt-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm shadow">
        Cadastrar rosto
      </Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="gradient-hero rounded-2xl p-8 text-center mb-8 shadow-lg relative overflow-hidden">
        {modoRapido && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <Zap size={11} className="text-yellow-300" />
            <span className="text-white text-[10px] font-bold">Busca instantânea</span>
          </div>
        )}
        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Camera size={28} className="text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold mb-1">
          {matches.length > 0
            ? <><span className="text-[#5BA4E5]">{matches.length} fotos</span> encontradas para você</>
            : "Nenhuma foto encontrada"}
        </h1>
        {matches.length > 0 && !confirmado && (
          <p className="text-white/50 text-xs mt-1 mb-0.5">Revise e marque só as que realmente são você</p>
        )}
        {matches.length > 0 && porEvento.length > 0 ? (
          <p className="text-white/70 text-sm">
            {porEvento.length === 1
              ? porEvento[0].eventoNome
              : porEvento.map(e => e.eventoNome).join(" · ")}
          </p>
        ) : matches.length > 0 && modoRapido ? (
          <p className="text-white/70 text-sm">
            {eventosCount > 1 ? `${eventosCount} eventos pesquisados` : evento ? evento.nome : "Busca concluída"}
          </p>
        ) : matches.length > 0 && evento ? (
          <p className="text-white/70 text-sm">{evento.nome}</p>
        ) : null}
      </div>

      {/* Ações */}
      {matches.length > 0 && !modoSelecao && (
        <div className="flex flex-wrap gap-3 mb-4">
          <button onClick={() => setModoSelecao(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
            <CheckSquare size={15} /> Selecionar fotos
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-[#1A4A80] font-semibold text-sm hover:bg-[#EFF5FF] transition">
            <Share2 size={15} /> Compartilhar link
          </button>
        </div>
      )}
      {/* Dica de confirmação */}
      {matches.length > 0 && !modoSelecao && !confirmado && (
        <p className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <UserCheck size={12} className="text-emerald-500" />
          Selecione só as fotos que realmente são você e clique em <strong className="text-emerald-600">São minhas</strong> para salvar.
        </p>
      )}

      {/* Seção Alta confiança */}
      {alta.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500" aria-hidden />
            <h2 className="font-bold text-[#0D2B4E] text-base">
              Alta confiança — Você aparece nestas fotos
            </h2>
            <span className="text-gray-400 text-sm">({alta.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {alta.map(m => (
              <FotoCard key={m.foto.id} match={m}
                selecionada={selecionadas.has(m.foto.id)}
                modoSelecao={modoSelecao}
                onToggleSel={() => toggleSel(m.foto.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Seção Talvez */}
      {talvez.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-400" aria-hidden />
            <h2 className="font-bold text-[#0D2B4E] text-base">Possível match — Talvez você apareça nestas</h2>
            <span className="text-gray-400 text-sm">({talvez.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {talvez.map(m => (
              <FotoCard key={m.foto.id} match={m}
                selecionada={selecionadas.has(m.foto.id)}
                modoSelecao={modoSelecao}
                onToggleSel={() => toggleSel(m.foto.id)} />
            ))}
          </div>
        </section>
      )}

      {fase === "done" && matches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Camera size={40} className="text-gray-300" />
          <p className="font-semibold text-[#0D2B4E]">Nenhuma foto encontrada</p>
          <p className="text-gray-400 text-sm max-w-xs">
            Tente com uma selfie mais nítida, de frente e com boa iluminação.
          </p>
          {!modoRapido && (
            <p className="text-[#2E7DD1] text-xs mt-1">
              Dica: peça ao administrador para indexar o evento — a busca ficará muito mais precisa.
            </p>
          )}

          {/* Diagnóstico — mostra o que foi pesquisado */}
          {(debug.totalEventos > 0 || debug.eventosIndexados > 0 || debug.eventosConsultados.length > 0) && (
            <details className="mt-4 max-w-lg w-full bg-gray-50 border border-gray-200 rounded-xl text-left" open>
              <summary className="cursor-pointer px-4 py-2 text-xs font-bold text-[#1A4A80] hover:bg-gray-100 rounded-xl">
                🔍 Detalhes da busca
              </summary>
              <div className="px-4 pb-3 pt-1 space-y-1 text-[11px] text-gray-600">
                <p>Seu email usado na busca: <strong className="text-[#2E7DD1]">{debug.emailUsado || "(vazio)"}</strong></p>
                {debug.eventosConsultados.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="font-bold text-[#0D2B4E] mb-1">Matches do admin por evento:</p>
                    {debug.eventosConsultados.map(ev => (
                      <div key={ev.id} className="ml-2 mb-1">
                        <p><strong>{ev.nome}</strong>:
                          {ev.temMatches
                            ? <span className="ml-1">{ev.emailsNoMatches.length} usuário(s) marcado(s)</span>
                            : <span className="ml-1 text-amber-600">sem _matches_*.json</span>
                          }
                        </p>
                        {ev.temMatches && ev.emailsNoMatches.length > 0 && (
                          <p className="ml-3 text-[10px] text-gray-400">
                            Emails: {ev.emailsNoMatches.map(e => (
                              <span key={e} className={`inline-block mx-1 px-1 rounded ${e.toLowerCase().trim() === debug.emailUsado ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-gray-100"}`}>
                                {e}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="font-bold text-[#0D2B4E] mb-1">Busca por IA local:</p>
                </div>
                <p>Eventos encontrados: <strong>{debug.totalEventos}</strong></p>
                <p>Eventos com índice: <strong className={debug.eventosIndexados === 0 ? "text-red-600" : "text-emerald-600"}>{debug.eventosIndexados}</strong>
                  {debug.eventosIndexados === 0 && debug.totalEventos > 0 && (
                    <span className="text-red-600 ml-1">← admin precisa indexar</span>
                  )}
                </p>
                <p>Fotos analisadas: <strong>{debug.fotosAnalisadas}</strong></p>
                {debug.melhorDistancia !== null && (
                  <p>
                    Sua melhor distância encontrada: <strong className={debug.melhorDistancia < debug.limiar ? "text-emerald-600" : debug.melhorDistancia < debug.limiar + 0.10 ? "text-amber-600" : "text-red-600"}>
                      {debug.melhorDistancia.toFixed(3)}
                    </strong> (precisa ser &lt; {debug.limiar})
                    {debug.melhorDistancia >= debug.limiar && debug.melhorDistancia < debug.limiar + 0.10 && (
                      <span className="block text-amber-600 mt-0.5">Quase! Tente uma selfie mais parecida com as fotos do evento (ângulo, iluminação).</span>
                    )}
                    {debug.melhorDistancia >= debug.limiar + 0.10 && (
                      <span className="block text-red-600 mt-0.5">Distância grande — seu rosto provavelmente não está nessas fotos.</span>
                    )}
                  </p>
                )}
                {debug.eventosIndexados === 0 && (
                  <p className="text-red-600 mt-2 pt-2 border-t border-gray-200">
                    Nenhum dos {debug.totalEventos} eventos tem índice de rostos no Drive. Admin precisa rodar &quot;Indexar todos&quot; em <code>/admin/reconhecimento</code>. Se já rodou, pode ser que o token Drive expirou e o índice não chegou a ser salvo.
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/cadastrar-rosto" className="inline-flex items-center gap-2 text-[#2E7DD1] text-sm font-semibold hover:underline">
          <ArrowLeft size={14} /> Nova busca
        </Link>
      </div>

      {/* Banner de confirmação bem-sucedida */}
      {confirmado && (
        <div className="fixed top-4 left-0 right-0 md:left-60 flex justify-center px-4 z-50 pointer-events-none animate-slide-up">
          <div className="pointer-events-auto flex items-center gap-2.5 bg-emerald-600 text-white rounded-2xl shadow-xl px-5 py-3 text-sm font-semibold">
            <UserCheck size={16} />
            Salvo! Suas fotos foram atualizadas.
            <button onClick={() => setConfirmado(false)} className="ml-1 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Barra de seleção */}
      {modoSelecao && (
        <div className="fixed bottom-6 left-0 right-0 md:bottom-6 md:left-60 flex justify-center px-4 z-40 pointer-events-none animate-slide-up">
          <div className="pointer-events-auto w-full md:w-auto flex items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl px-3 sm:px-3 py-2 text-sm">
            {/* Contagem + toggle */}
            <button onClick={selecionarTodas}
              className="flex items-center gap-1.5 text-[#1A4A80] font-semibold hover:text-[#2E7DD1] transition px-1.5 py-1 shrink-0">
              {todasSel ? <CheckSquare size={15} className="text-[#2E7DD1]" /> : <Square size={15} />}
              <span className="hidden sm:inline">{todasSel ? "Desmarcar" : "Todas"}</span>
            </button>
            <span className="text-gray-300 shrink-0">|</span>
            <span className="text-gray-500 text-xs sm:text-sm font-medium shrink-0">
              {selecionadas.size} foto{selecionadas.size !== 1 ? "s" : ""}
            </span>

            {/* Ações — empurradas para a direita no mobile */}
            <div className="flex items-center gap-1.5 ml-auto">
              {selecionadas.size > 0 && (
                <>
                  <button onClick={confirmarMinhasFotos} disabled={confirmando}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow transition disabled:opacity-60">
                    {confirmando ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                    <span>{confirmando ? "Salvando..." : "São minhas"}</span>
                  </button>
                  <button onClick={baixarSelecionadas} disabled={baixando}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-xs sm:text-sm font-semibold shadow hover:opacity-90 transition disabled:opacity-60">
                    {baixando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    <span className="hidden sm:inline">{baixando ? "Baixando..." : "Baixar ZIP"}</span>
                    <span className="sm:hidden">{baixando ? "..." : "ZIP"}</span>
                  </button>
                </>
              )}
              <button onClick={() => { setModoSelecao(false); setSelecionadas(new Set()); }}
                className="flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
