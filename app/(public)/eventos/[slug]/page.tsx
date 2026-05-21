"use client";
import { use, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Camera, Calendar, Scan, ArrowLeft,
  Share2, Filter, AlertCircle, CheckSquare, Square,
  X, Download, ImagePlus, ScanFace, ChevronRight, Heart, Loader2,
} from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import FotoCard from "@/app/components/FotoCard";
import Lightbox from "@/app/components/Lightbox";
import { AnimatePresence } from "framer-motion";
import GaleriaLoading from "@/app/components/GaleriaLoading";
import { baixarComoZip } from "@/lib/download-zip";
import { lerFavoritos, salvarFavoritos } from "@/app/(public)/favoritos/page";
import { fetchMinhasFotos, lerCacheMinhasFotos, ouvirAtualizacoes } from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";

type FiltroKey = "todas" | "minhas" | "favoritas";

interface DrivePhoto { id: string; name: string; }
interface FotoDesc { fotoId: string; rostos: { descriptor: number[] }[] }

function distEuclid(a: Float32Array, b: number[]) {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s);
}


function syncEvento(ev: EventoItem, fotos: DrivePhoto[], capaOverride?: string) {
  const capa_id   = capaOverride ?? (ev.capa_id || fotos[0]?.id);
  const precisaSync = capaOverride || !ev.capa_id || ev.total_fotos !== fotos.length;
  if (!precisaSync || !fotos.length) return;
  fetch(`/api/eventos?id=${ev.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capa_id, total_fotos: fotos.length }),
  }).catch(() => {});
}

export default function EventoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const [evento,    setEvento]    = useState<EventoItem | null>(null);
  const [fotos,     setFotos]     = useState<DrivePhoto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [erro,      setErro]      = useState("");
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [favoritos,    setFavoritos]    = useState<Set<string>>(new Set());
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modoSelecao,  setModoSelecao]  = useState(false);
  const [baixando,     setBaixando]     = useState(false);
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null);

  // Filtro ativo — inicia em "minhas" se vier da lista com ?filtro=minhas
  const filtroInicial = (searchParams.get("filtro") as FiltroKey | null) ?? "todas";
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroKey>(filtroInicial);

  // Banner "Encontramos você"
  const [minhasFotosEvento, setMinhasFotosEvento] = useState<string[]>([]);
  const [nomeUsuario,       setNomeUsuario]       = useState("");
  const [bannerFechado,     setBannerFechado]     = useState(false);

  // Busca fotos do usuário neste evento (via índice pré-computado)
  const buscarMinhasFotos = useCallback(async (eventoId: string) => {
    try {
      // 1. Quem é o usuário?
      let nome = "";
      let email = "";
      try {
        const u = JSON.parse(localStorage.getItem("usuario_simples") ?? "null");
        if (u) { nome = u.nome; email = u.email; }
      } catch { /**/ }
      const sessao = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
      if (sessao?.user) { nome = sessao.user.name ?? nome; email = sessao.user.email ?? email; }
      if (nome) setNomeUsuario(nome.split(" ")[0]);

      // 2. Render imediato via cache local
      if (email) {
        const cached = lerCacheMinhasFotos(email);
        const evCache = cached?.porEvento.find(e => e.eventoId === eventoId);
        if (evCache?.fotos.length) setMinhasFotosEvento(evCache.fotos);
      }

      // 3. Fonte de verdade: Drive (via helper unificado)
      if (email) {
        const fresh = await fetchMinhasFotos(email);
        const evFresh = fresh?.porEvento.find(e => e.eventoId === eventoId);
        if (evFresh?.fotos.length) {
          setMinhasFotosEvento(evFresh.fotos);
          return;
        }
      }

      // 4. Fallback: índice de matches por evento (caminho admin)
      if (email) {
        const mRes = await fetch(`/api/matches?eventoId=${eventoId}`);
        if (mRes.ok) {
          const mData = await mRes.json();
          if (mData?.usuarios) {
            const eu = mData.usuarios.find((u: { email: string; fotosIds: string[] }) => u.email === email);
            if (eu?.fotosIds?.length) {
              setMinhasFotosEvento(eu.fotosIds);
              return;
            }
          }
        }
      }

      // 5. Fallback: compara descriptor salvo com índice do evento
      const descRaw = sessionStorage.getItem("faceDescriptor") ?? localStorage.getItem("face_descriptor_v1");
      if (!descRaw) return;
      const meuDesc = new Float32Array(JSON.parse(descRaw));
      const idxData = await fetchDescritores(eventoId);
      if (!idxData?.indexado || !idxData.dados?.length) return;

      const encontradas: string[] = [];
      for (const foto of idxData.dados as FotoDesc[]) {
        for (const rosto of foto.rostos) {
          if (distEuclid(meuDesc, rosto.descriptor) < 0.60) {
            encontradas.push(foto.fotoId); break;
          }
        }
      }
      if (encontradas.length) setMinhasFotosEvento(encontradas);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s?.user?.isAdmin) setIsAdmin(true);
    }).catch(() => {});
    // Carrega favoritos persistidos
    setFavoritos(new Set(lerFavoritos()));
  }, []);

  // Re-fetch das "minhas fotos" quando outra página atualiza
  useEffect(() => {
    if (!evento?.id) return;
    return ouvirAtualizacoes(() => { if (evento?.id) buscarMinhasFotos(evento.id); });
  }, [evento?.id, buscarMinhasFotos]);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/eventos");
        const lista: EventoItem[] = await res.json();
        const ev   = lista.find((e) => e.id === slug) ?? null;
        setEvento(ev);

        if (ev?.id) buscarMinhasFotos(ev.id);
        if (!ev?.folder_id) { setLoading(false); return; }

        const cacheKey = `fotos_${ev.folder_id}`;
        let fotosCarregadas: DrivePhoto[] = [];

        // 1. Carrega do cache local primeiro → exibe imediatamente
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { fotos: cachedFotos, ts } = JSON.parse(cached);
            fotosCarregadas = cachedFotos;
            setFotos(cachedFotos);
            setLoading(false);
          }
        } catch { /* ignora erros de localStorage */ }

        // 2. Sempre busca do Drive para garantir lista completa e atualizada
        const fRes  = await fetch(`/api/fotos?folderId=${ev.folder_id}`);
        const fData = await fRes.json();
        if (fData.error) {
          if (!fotosCarregadas.length) setErro(fData.error);
        } else {
          // Deduplicar por id antes de exibir
          const raw: DrivePhoto[] = fData.fotos ?? [];
          const novas = Array.from(new Map(raw.map(f => [f.id, f])).values());
          // Só atualiza se vier fotos (evita piscar com lista menor que o cache)
          if (novas.length > 0) {
            setFotos(novas);
            try {
              localStorage.setItem(cacheKey, JSON.stringify({ fotos: novas, ts: Date.now() }));
            } catch { /**/ }
            syncEvento(ev, novas);
          }
        }
      } catch { setErro("Erro ao carregar fotos."); }
      finally   { setLoading(false); }
    }
    load();
  }, [slug]);

  function definirCapa(id: string) {
    if (!evento) return;
    setEvento(prev => prev ? { ...prev, capa_id: id } : prev);
    syncEvento(evento, fotos, id);
    alert("Foto definida como capa do evento!");
  }

  function toggleFav(id: string) {
    setFavoritos(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      salvarFavoritos(Array.from(n));
      return n;
    });
  }

  function toggleSel(id: string) {
    setSelecionadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Fotos filtradas conforme filtro ativo
  const fotosFiltradas = useMemo(() => {
    if (filtroAtivo === "minhas")    return fotos.filter(f => minhasFotosEvento.includes(f.id));
    if (filtroAtivo === "favoritas") return fotos.filter(f => favoritos.has(f.id));
    return fotos;
  }, [fotos, filtroAtivo, minhasFotosEvento, favoritos]);

  function selecionarTodas() {
    const ids = new Set(fotosFiltradas.map(f => f.id));
    setSelecionadas(selecionadas.size === fotosFiltradas.length && fotosFiltradas.length > 0 ? new Set() : ids);
  }

  function cancelarSelecao() {
    setModoSelecao(false);
    setSelecionadas(new Set());
  }

  async function baixarSelecionadas() {
    setBaixando(true);
    const nomeEvento = evento?.nome?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "evento";
    await baixarComoZip(Array.from(selecionadas), `fotos-${nomeEvento}.zip`);
    setBaixando(false);
  }

  function compartilharLink() {
    const ids = Array.from(selecionadas).join(",");
    const url = `${window.location.href}?fotos=${ids}`;
    navigator.clipboard.writeText(url).then(() => alert("Link copiado!"));
  }

  const todasSel = selecionadas.size === fotos.length && fotos.length > 0;

  return (
    <div>
      {/* Capa */}
      <div className="h-48 lg:h-72 relative flex items-end overflow-hidden">
        {/* Colagem espalhada como fundo */}
        {fotos.length > 0 ? (
          <div className="absolute inset-0 overflow-hidden">
            {/* fundo sólido atrás */}
            <div className="absolute inset-0 bg-[#0D2B4E]" />
            {[
              { x: "-4%",  y: "-10%", w: 260, h: 160, rot: -3  },
              { x: "12%",  y: "-15%", w: 200, h: 130, rot:  2  },
              { x: "28%",  y: "-8%",  w: 280, h: 170, rot: -1.5},
              { x: "52%",  y: "-12%", w: 220, h: 145, rot:  3  },
              { x: "70%",  y: "-6%",  w: 240, h: 155, rot: -2  },
              { x: "88%",  y: "-14%", w: 200, h: 130, rot:  1.5},
              { x: "-2%",  y: "38%",  w: 220, h: 145, rot:  2  },
              { x: "18%",  y: "42%",  w: 260, h: 160, rot: -2.5},
              { x: "38%",  y: "35%",  w: 200, h: 130, rot:  1  },
              { x: "57%",  y: "40%",  w: 240, h: 155, rot: -1  },
              { x: "76%",  y: "36%",  w: 220, h: 140, rot:  2.5},
              { x: "92%",  y: "42%",  w: 190, h: 125, rot: -3  },
            ].map((p, i) => fotos[i] && (
              <img
                key={fotos[i].id}
                src={`/api/thumb?id=${fotos[i].id}&sz=400`}
                alt="" aria-hidden
                className="absolute object-cover rounded-lg shadow-2xl"
                style={{
                  left: p.x, top: p.y,
                  width: p.w, height: p.h,
                  transform: `rotate(${p.rot}deg)`,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 gradient-hero flex items-center justify-center">
            <Camera size={64} className="text-white/20" />
          </div>
        )}
        {/* Overlay gradiente sobre o mosaico */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/95 via-[#0D2B4E]/50 to-[#0D2B4E]/30" />
        <div className="relative z-10 p-6 lg:px-10 w-full">
          <Link href="/eventos" className="inline-flex items-center gap-1.5 text-white/70 text-sm hover:text-white mb-3 transition">
            <ArrowLeft size={15} /> Voltar
          </Link>
          <h1 className="text-white text-2xl lg:text-3xl font-bold">
            {loading ? "Carregando..." : evento?.nome ?? "Evento"}
          </h1>
          {evento && (
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-white/70 text-sm">
                <Calendar size={14} />
                {new Date(evento.data).toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}
              </span>
              <span className="flex items-center gap-1.5 text-white/70 text-sm">
                <Camera size={14} /> {fotos.length} fotos
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">

        {/* Ações principais */}
        {!modoSelecao && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/cadastrar-rosto"
              className="flex items-center gap-2 px-5 py-3 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
              <Scan size={16} /> Encontrar minhas fotos
            </Link>
            {fotos.length > 0 && (
              <button
                onClick={() => setModoSelecao(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-[#2E7DD1] text-[#2E7DD1] font-semibold text-sm hover:bg-[#EFF5FF] transition">
                <CheckSquare size={16} /> Selecionar fotos
              </button>
            )}
            <button className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-[#1A4A80] font-semibold text-sm hover:bg-[#EFF5FF] transition">
              <Share2 size={16} /> Compartilhar evento
            </button>
          </div>
        )}

        {/* ── Banner "Encontramos você" ──────────────────────────── */}
        {!bannerFechado && minhasFotosEvento.length > 0 && !modoSelecao && (
          <div className="mb-6 bg-[#EFF5FF] border border-[#2E7DD1]/25 rounded-2xl p-4 relative animate-fade-up">
            {/* Fechar */}
            <button
              onClick={() => setBannerFechado(true)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
              <X size={14} />
            </button>

            {/* Cabeçalho */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow">
                <ScanFace size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-[#0D2B4E] text-sm">
                  Acho que é você{nomeUsuario ? `, ${nomeUsuario}` : ""}! 🤔
                </p>
                <p className="text-xs text-gray-500">
                  {minhasFotosEvento.length} possível{minhasFotosEvento.length !== 1 ? "is" : ""} foto{minhasFotosEvento.length !== 1 ? "s" : ""} sua{minhasFotosEvento.length !== 1 ? "s" : ""} neste evento — confira
                </p>
              </div>
              <button
                onClick={() => { setFiltroAtivo("minhas"); setBannerFechado(true); }}
                className="ml-auto flex items-center gap-1 text-[#2E7DD1] text-xs font-bold hover:underline shrink-0 pr-8">
                Conferir ({minhasFotosEvento.length}) <ChevronRight size={13} />
              </button>
            </div>
            <p className="text-[10px] text-amber-700/70 bg-amber-50/60 border border-amber-200/60 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1">
              💡 A IA pode errar (luz, ângulo, maquiagem). Marque só as que são suas em <strong>São minhas</strong>.
            </p>

            {/* Fotos em scroll horizontal — máx 8 no banner */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {minhasFotosEvento.slice(0, 8).map(id => (
                <div key={id} className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-md">
                  <img
                    src={`/api/thumb?id=${id}&sz=300`}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
              {/* Botão "Ver todas" inline — abre o filtro Minhas fotos */}
              {minhasFotosEvento.length > 8 && (
                <button
                  onClick={() => { setFiltroAtivo("minhas"); setBannerFechado(true); }}
                  className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-[#2E7DD1]/40 flex flex-col items-center justify-center gap-1 text-[#2E7DD1] hover:bg-white transition">
                  <ChevronRight size={18} />
                  <span className="text-[10px] font-semibold">+{minhasFotosEvento.length - 8}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Espaço reservado para não sobrepor conteúdo quando barra estiver fixada */}
        {modoSelecao && <div className="h-20 mb-2" />}

        {/* Filtros */}
        {!modoSelecao && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex gap-2 flex-wrap">

              {/* Todas */}
              <button
                onClick={() => setFiltroAtivo("todas")}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition
                  ${filtroAtivo === "todas"
                    ? "gradient-primary text-white shadow"
                    : "bg-white border border-gray-200 text-[#1A4A80] hover:border-[#2E7DD1]"}`}>
                Todas
                <span className="ml-1.5 text-[11px] opacity-70">({fotos.length})</span>
              </button>

              {/* Minhas fotos — só mostra se tiver resultado do reconhecimento */}
              <button
                onClick={() => setFiltroAtivo("minhas")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition
                  ${filtroAtivo === "minhas"
                    ? "gradient-primary text-white shadow"
                    : minhasFotosEvento.length > 0
                      ? "bg-white border border-[#2E7DD1] text-[#2E7DD1] hover:bg-[#EFF5FF]"
                      : "bg-white border border-gray-200 text-gray-400 cursor-not-allowed"}`}
                disabled={minhasFotosEvento.length === 0}
                title={minhasFotosEvento.length === 0 ? "Cadastre seu rosto para ver suas fotos" : undefined}>
                <ScanFace size={13} />
                Minhas fotos
                {minhasFotosEvento.length > 0 && (
                  <span className={`ml-0.5 text-[11px] ${filtroAtivo === "minhas" ? "opacity-80" : "opacity-70"}`}>
                    ({minhasFotosEvento.length})
                  </span>
                )}
              </button>

              {/* Favoritas */}
              <button
                onClick={() => setFiltroAtivo("favoritas")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition
                  ${filtroAtivo === "favoritas"
                    ? "bg-red-500 text-white shadow"
                    : favoritos.size > 0
                      ? "bg-white border border-red-300 text-red-500 hover:bg-red-50"
                      : "bg-white border border-gray-200 text-gray-400 cursor-not-allowed"}`}
                disabled={favoritos.size === 0}
                title={favoritos.size === 0 ? "Você ainda não favoritou nenhuma foto" : undefined}>
                <Heart size={12} fill={filtroAtivo === "favoritas" ? "white" : favoritos.size > 0 ? "currentColor" : "none"} />
                Favoritas
                {favoritos.size > 0 && (
                  <span className={`ml-0.5 text-[11px] ${filtroAtivo === "favoritas" ? "opacity-80" : "opacity-70"}`}>
                    ({favoritos.size})
                  </span>
                )}
              </button>
            </div>

            {/* Aviso quando filtro não tem resultado */}
            {fotosFiltradas.length === 0 && filtroAtivo !== "todas" && (
              <span className="text-xs text-gray-400 ml-1">Nenhuma foto neste filtro</span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && <GaleriaLoading />}

        {/* Erro */}
        {!loading && erro && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
            <AlertCircle size={20} className="shrink-0" />
            <div>
              <p className="font-semibold">Erro ao carregar fotos</p>
              <p className="text-sm mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        {/* Sem pasta */}
        {!loading && !erro && !evento?.folder_id && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow">
              <Camera size={28} className="text-white" />
            </div>
            <p className="font-semibold text-[#0D2B4E]">Nenhuma pasta configurada</p>
            <p className="text-gray-400 text-sm">Configure uma pasta do Drive no painel administrativo.</p>
          </div>
        )}

        {/* Sem fotos */}
        {!loading && !erro && evento?.folder_id && fotos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Camera size={36} className="text-gray-300" />
            <p className="font-semibold text-[#0D2B4E]">Nenhuma foto encontrada</p>
            <p className="text-gray-400 text-sm">A pasta está vazia ou sem fotos acessíveis.</p>
          </div>
        )}

        {/* ── GRID DE FOTOS (masonry — proporção natural) ── */}
        {!loading && fotos.length > 0 && (
          <>
            <p className="text-gray-500 text-sm mb-4">
              {fotosFiltradas.length === fotos.length
                ? `${fotos.length} fotos`
                : `${fotosFiltradas.length} de ${fotos.length} fotos`}
            </p>

            {fotosFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                {filtroAtivo === "minhas"
                  ? <><ScanFace size={36} className="text-gray-300" />
                      <p className="font-semibold text-[#0D2B4E]">Nenhuma foto sua encontrada</p>
                      <p className="text-gray-400 text-sm">Cadastre seu rosto para buscar automaticamente</p>
                      <Link href="/cadastrar-rosto" className="mt-1 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold shadow hover:opacity-90 transition">
                        Cadastrar meu rosto
                      </Link></>
                  : <><Heart size={36} className="text-gray-300" />
                      <p className="font-semibold text-[#0D2B4E]">Nenhuma foto favoritada</p>
                      <p className="text-gray-400 text-sm">Clique no coração de qualquer foto para salvar</p></>
                }
              </div>
            ) : (
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                {fotosFiltradas.map((foto, idx) => (
                  <FotoCard
                    key={foto.id}
                    id={foto.id}
                    name={foto.name}
                    index={idx}
                    masonry
                    selecionada={selecionadas.has(foto.id)}
                    favoritada={favoritos.has(foto.id)}
                    modoSelecao={modoSelecao}
                    isCapa={foto.id === evento?.capa_id}
                    isAdmin={isAdmin}
                    onToggleSel={() => toggleSel(foto.id)}
                    onToggleFav={() => toggleFav(foto.id)}
                    onIniciarSelecao={() => { setModoSelecao(true); toggleSel(foto.id); }}
                    onOpenLightbox={() => setLightboxIdx(idx)}
                    onDefinirCapa={() => definirCapa(foto.id)}
                    downloadUrl={`/api/download?id=${foto.id}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox
            fotos={fotosFiltradas}
            index={lightboxIdx}
            favoritos={favoritos}
            onClose={() => setLightboxIdx(null)}
            onPrev={() => setLightboxIdx((i) => Math.max(0, (i ?? 1) - 1))}
            onNext={() => setLightboxIdx((i) => Math.min(fotosFiltradas.length - 1, (i ?? 0) + 1))}
            onToggleFav={toggleFav}
          />
        )}
      </AnimatePresence>

      {/* Barra de seleção fixada no rodapé */}
      {modoSelecao && (
        <div className="fixed bottom-4 left-1/2 lg:left-[calc(7.5rem+50%)] -translate-x-1/2 z-40 animate-slide-up">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl px-3 py-2 text-sm whitespace-nowrap">
            <button onClick={selecionarTodas}
              className="flex items-center gap-1.5 text-[#1A4A80] font-semibold hover:text-[#2E7DD1] transition px-2 py-1">
              {todasSel ? <CheckSquare size={14} className="text-[#2E7DD1]" /> : <Square size={14} />}
              {todasSel ? "Desmarcar" : "Todas"}
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500 px-1">{selecionadas.size} foto{selecionadas.size !== 1 ? "s" : ""}</span>
            {selecionadas.size > 0 && (
              <>
                <button onClick={baixarSelecionadas} disabled={baixando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl gradient-primary text-white font-semibold shadow hover:opacity-90 transition disabled:opacity-60">
                  {baixando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {baixando ? "Baixando..." : "Baixar ZIP"}
                </button>
                <button onClick={compartilharLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2E7DD1] text-[#2E7DD1] font-semibold hover:bg-[#EFF5FF] transition">
                  <Share2 size={13} /> Link
                </button>
              </>
            )}
            <button onClick={cancelarSelecao}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
