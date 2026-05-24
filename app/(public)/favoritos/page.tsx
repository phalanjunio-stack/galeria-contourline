"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Heart, ScanFace, Images, CalendarDays, ChevronRight,
  Loader2, Download, ExternalLink, Trash2,
  Scan, Camera, Bell,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ─── Tipos ────────────────────────────────────────────────── */
interface EventoItem {
  id: string; nome: string; data: string; status: string;
  folder_id: string; total_fotos: number; capa_id?: string;
}
interface FotoDescritores {
  fotoId: string;
  rostos: { descriptor: number[] }[];
}

function slugify(n: string) {
  return n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

import {
  fetchMinhasFotos, salvarCacheMinhasFotos,
  ouvirAtualizacoes, lerDescriptor,
} from "@/lib/minhasFotos";
import type { MinhasFotosEvento } from "@/lib/minhasFotos";
import { fetchDescritores } from "@/lib/descritoresCache";
import { SkeletonRow } from "@/app/components/Skeleton";

/* ─── localStorage helpers ─────────────────────────────────── */
const FAV_KEY = "favoritos_v1";

export function lerFavoritos(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; }
}
export function salvarFavoritos(ids: string[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); } catch {}
  // Sincroniza com servidor em background (sem bloquear a UI)
  try {
    const u = JSON.parse(localStorage.getItem("usuario_simples") ?? "null");
    const email = u?.email;
    if (email) {
      fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome: u?.nome, favoritos: ids }),
      }).catch(() => {});
    } else {
      // Google OAuth — o email vem da sessão
      fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoritos: ids }),
      }).catch(() => {});
    }
  } catch { /**/ }
}
export function toggleFavorito(id: string): boolean {
  const favs = lerFavoritos();
  const idx  = favs.indexOf(id);
  if (idx >= 0) { favs.splice(idx, 1); salvarFavoritos(favs); return false; }
  favs.unshift(id);
  salvarFavoritos(favs);
  return true;
}
export function isFavorito(id: string): boolean {
  return lerFavoritos().includes(id);
}

/* ─── Distância euclidiana ─────────────────────────────────── */
function dist(a: Float32Array, b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/* ─── Mini card de foto ─────────────────────────────────────── */
function FotoCard({
  id, favorito = false, onRemoveFav,
}: { id: string; favorito?: boolean; onRemoveFav?: (id: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [hover,  setHover]  = useState(false);

  return (
    <div
      className="relative flex-shrink-0 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer group aspect-square"
      style={{ background: "rgba(26,74,128,0.12)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-[#1A4A80]/15 rounded-xl" />}
      <img
        src={`/api/thumb?id=${id}&sz=300`}
        alt=""
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-transform duration-300 ${hover ? "scale-105" : ""} ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
      />
      {hover && (
        <div className="absolute inset-0 bg-[#0D2B4E]/55 flex items-center justify-center gap-2">
          <a href={`/api/thumb?id=${id}&sz=1200`} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
            <ExternalLink size={13} className="text-white" />
          </a>
          <a href={`/api/download?id=${id}`} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
            <Download size={13} className="text-white" />
          </a>
          {favorito && onRemoveFav && (
            <button onClick={e => { e.stopPropagation(); onRemoveFav(id); }}
              className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center transition"
              title="Remover dos favoritos">
              <Trash2 size={13} className="text-white" />
            </button>
          )}
        </div>
      )}
      {favorito && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow">
          <Heart size={10} className="text-white fill-white" />
        </div>
      )}
    </div>
  );
}

/* ─── Card de evento ────────────────────────────────────────── */
function EventoCard({ ev }: { ev: EventoItem }) {
  const slug = `${ev.id}-${slugify(ev.nome)}`;
  return (
    <Link href={`/eventos/${slug}`}
      className="group relative flex-shrink-0 w-40 sm:w-48 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all">
      <div className="aspect-[3/4]" style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
        {ev.capa_id
          ? <img src={`/api/thumb?id=${ev.capa_id}&sz=400`} alt={ev.nome}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center">
              <Camera size={28} className="text-white/30" />
            </div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,0.85),rgba(0,0,0,0.3),transparent)" }}>
        <p className="text-white font-bold text-xs leading-tight line-clamp-2">{ev.nome}</p>
        <p className="text-white/60 text-[10px] mt-0.5">
          {new Date(ev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          {ev.total_fotos > 0 && ` · ${ev.total_fotos} fotos`}
        </p>
      </div>
    </Link>
  );
}

/* ─── Scroll horizontal ─────────────────────────────────────── */
function ScrollRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex gap-3 overflow-x-auto pb-2 ${className}`} style={{ scrollbarWidth: "none" }}>
      {children}
    </div>
  );
}

/* ─── Seção ─────────────────────────────────────────────────── */
function Secao({
  icon, titulo, cor = "#2E7DD1", href, children, empty,
}: {
  icon: React.ReactNode;
  titulo: string;
  cor?: string;
  href?: string;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl shadow border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#0D2B4E] flex items-center gap-2 text-base">
          <span style={{ color: cor }}>{icon}</span>
          {titulo}
        </h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: cor }}>
            Ver todos <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {children ?? empty}
    </section>
  );
}

/* ─── Página principal ──────────────────────────────────────── */
export default function FavoritosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);
  const [carregando,     setCarregando]     = useState(true);

  // Favoritos
  const [favoritos,    setFavoritos]    = useState<string[]>([]);

  // "Encontramos você"
  const [minhasFotos,    setMinhasFotos]    = useState<string[]>([]);
  const [buscandoRosto,  setBuscandoRosto]  = useState(false);
  const [usouIndex,      setUsouIndex]      = useState(false);
  const [novasMinhasFotos, setNovasMinhasFotos] = useState(0);

  // Últimas fotos / eventos
  const [fotosRecentes,   setFotosRecentes]   = useState<string[]>([]);
  const [eventosRecentes, setEventosRecentes] = useState<EventoItem[]>([]);

  // Lê usuário simples
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usuario_simples");
      if (raw) setUsuarioSimples(JSON.parse(raw));
    } catch {}
  }, []);

  const logado = status !== "loading" && (!!session?.user || !!usuarioSimples);

  // Redireciona se não logado
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user && !usuarioSimples) {
      // Dá um tempo para o localStorage ser lido
      const t = setTimeout(() => {
        const raw = localStorage.getItem("usuario_simples");
        if (!raw) router.push("/cadastrar-rosto");
      }, 400);
      return () => clearTimeout(t);
    }
  }, [session, status, usuarioSimples, router]);

  // Carrega favoritos (localStorage imediato + servidor em background)
  useEffect(() => {
    const local = lerFavoritos();
    setFavoritos(local);

    // Busca do servidor em background e mescla com o localStorage
    const email = session?.user?.email ?? usuarioSimples?.email;
    const url = email
      ? `/api/favoritos?email=${encodeURIComponent(email)}`
      : "/api/favoritos";

    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then((servidor: string[]) => {
        if (!Array.isArray(servidor) || servidor.length === 0) return;
        // Mescla: servidor primeiro (mais recente), local como complemento
        const merged = Array.from(new Set([...servidor, ...local]));
        setFavoritos(merged);
        // Atualiza localStorage com versão mesclada
        try { localStorage.setItem(FAV_KEY, JSON.stringify(merged)); } catch {}
      })
      .catch(() => {});
  }, [session, usuarioSimples]);

  // Carrega eventos recentes + fotos recentes
  useEffect(() => {
    const FOTOS_CACHE_TTL = 5 * 60 * 1000;
    fetch("/api/eventos", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then((lista: EventoItem[]) => {
        if (!Array.isArray(lista)) return;
        const ativos = lista.filter(e => e.status === "aberto" && e.folder_id).slice(0, 6);
        setEventosRecentes(ativos);

        // Pega algumas fotos recentes do primeiro evento
        const primeiro = ativos[0];
        if (primeiro) {
          const cacheKey = `fotos_${primeiro.folder_id}`;
          const cached   = localStorage.getItem(cacheKey);
          let usouCache  = false;
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              const idade  = Date.now() - (parsed.ts ?? 0);
              if (idade < FOTOS_CACHE_TTL && Array.isArray(parsed.fotos)) {
                setFotosRecentes(parsed.fotos.slice(0, 8).map((f: { id: string }) => f.id));
                usouCache = true;
              }
            } catch {}
          }
          if (!usouCache) {
            fetch(`/api/fotos?folderId=${primeiro.folder_id}`, { cache: "no-store" })
              .then(r => r.ok ? r.json() : { fotos: [] })
              .then(d => {
                const raw = d.fotos ?? [];
                setFotosRecentes(raw.slice(0, 8).map((f: { id: string }) => f.id));
                try { localStorage.setItem(cacheKey, JSON.stringify({ fotos: raw, ts: Date.now() })); } catch {}
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  // "Encontramos você" — Drive primeiro, descriptor como fallback
  const buscarMinhasFotos = useCallback(async () => {
    let email = session?.user?.email ?? usuarioSimples?.email;
    if (!email) {
      try { email = JSON.parse(localStorage.getItem("usuario_simples") ?? "null")?.email; } catch {}
    }

    function dispararNotif(count: number) {
      try {
        const vistoAntes = parseInt(localStorage.getItem("notif_fotos_visto") ?? "0");
        const novas = Math.max(0, count - vistoAntes);
        setNovasMinhasFotos(novas);
        if (novas > 0) {
          localStorage.setItem("notif_novas_fotos", String(novas));
          window.dispatchEvent(new CustomEvent("notif-update"));
        }
        setTimeout(() => {
          localStorage.setItem("notif_fotos_visto", String(count));
          localStorage.setItem("notif_novas_fotos", "0");
          setNovasMinhasFotos(0);
          window.dispatchEvent(new CustomEvent("notif-update"));
        }, 5000);
      } catch { /**/ }
    }

    // 1. Fonte de verdade: Drive (com cache interno do helper)
    if (email) {
      const fresh = await fetchMinhasFotos(email);
      if (fresh?.matches?.length) {
        setUsouIndex(true);
        const ids = fresh.matches.map(m => m.id);
        setMinhasFotos(ids.slice(0, 12));
        dispararNotif(ids.length);
        return;
      }
    }

    // 2. Fallback: busca ao vivo com descriptor
    const meuDescriptor = lerDescriptor();
    if (!meuDescriptor) return;

    setBuscandoRosto(true);
    try {
      const evRes = await fetch("/api/eventos");
      const eventos: EventoItem[] = evRes.ok ? await evRes.json() : [];
      const ativos = eventos.filter(e => e.folder_id);
      if (!ativos.length) { setBuscandoRosto(false); return; }

      const encontradas: string[] = [];
      const porEvento: MinhasFotosEvento[] = [];
      const LIMIAR = 0.58;

      for (const ev of ativos) {
        if (encontradas.length >= 30) break;
        try {
          const idxData = await fetchDescritores(ev.id);
          if (!idxData?.indexado || !idxData.dados?.length) continue;

          const fotosEvento: string[] = [];
          for (const foto of idxData.dados as FotoDescritores[]) {
            if (encontradas.length >= 30) break;
            let melhor = Infinity;
            for (const rosto of foto.rostos) {
              const d = dist(meuDescriptor, rosto.descriptor);
              if (d < melhor) melhor = d;
            }
            if (melhor < LIMIAR) {
              encontradas.push(foto.fotoId);
              fotosEvento.push(foto.fotoId);
            }
          }
          if (fotosEvento.length) {
            porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: fotosEvento });
          }
        } catch { /**/ }
      }

      setUsouIndex(true);
      setMinhasFotos(encontradas.slice(0, 12));

      if (encontradas.length > 0 && email) {
        salvarCacheMinhasFotos(email, {
          matches: encontradas.map(id => ({ id, distancia: 0.4 })),
          porEvento,
        });
      }

      dispararNotif(encontradas.length);
    } catch (e) {
      console.error("[Favoritos] erro ao buscar fotos:", e);
    }
    setBuscandoRosto(false);
  }, [session?.user?.email, usuarioSimples?.email]);

  useEffect(() => {
    if (status === "loading") return;
    buscarMinhasFotos();
    // Re-fetch quando outra página atualiza
    return ouvirAtualizacoes(buscarMinhasFotos);
  }, [buscarMinhasFotos, status]);

  function removerFavorito(id: string) {
    const novos = favoritos.filter(f => f !== id);
    setFavoritos(novos);
    salvarFavoritos(novos);
  }

  // ── Loading com skeleton ────────────────────────────────────
  if (status === "loading" || (carregando && !usuarioSimples && !session)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow border border-gray-100 p-5">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-4" />
          <SkeletonRow count={5} />
        </div>
        <div className="bg-white rounded-3xl shadow border border-gray-100 p-5">
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
          <SkeletonRow count={5} />
        </div>
      </div>
    );
  }

  if (!logado) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Heart size={34} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-[#0D2B4E] mb-2">Favoritos</h1>
        <p className="text-gray-400 text-sm mb-8">Entre para salvar e ver suas fotos favoritas.</p>
        <Link href="/cadastrar-rosto"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl gradient-primary text-white font-bold shadow-lg hover:opacity-90 transition">
          <Scan size={16} /> Entrar ou cadastrar
        </Link>
      </div>
    );
  }

  const nomeExibido = session?.user?.name ?? usuarioSimples?.nome ?? "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow"
          style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
          <Heart size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#0D2B4E]">
            Olá{nomeExibido ? `, ${nomeExibido.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-gray-400 text-sm">Suas fotos e eventos salvos</p>
        </div>
      </div>

      {/* ── FAVORITOS ─────────────────────────────────────────── */}
      <Secao
        icon={<Heart size={17} fill="currentColor" />}
        titulo="Favoritos"
        cor="#e11d48"
        empty={
          <div className="flex flex-col items-center py-8 gap-2 text-center">
            <Heart size={32} className="text-gray-200" />
            <p className="text-gray-400 text-sm font-medium">Nenhuma foto favorita ainda</p>
            <p className="text-gray-300 text-xs">Toque no coração em qualquer foto para salvar aqui</p>
          </div>
        }
      >
        {favoritos.length > 0 ? (
          <ScrollRow>
            {favoritos.slice(0, 20).map(id => (
              <div key={id} className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32">
                <FotoCard id={id} favorito onRemoveFav={removerFavorito} />
              </div>
            ))}
          </ScrollRow>
        ) : null}
      </Secao>

      {/* ── ENCONTRAMOS VOCÊ ──────────────────────────────────── */}
      <Secao
        icon={<ScanFace size={17} />}
        titulo="Acho que é você 🤔"
        cor="#2E7DD1"
        href="/resultado"
      >
        {buscandoRosto ? (
          <div className="flex items-center gap-3 py-6 text-[#2E7DD1]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Buscando suas fotos em todos os eventos...</span>
          </div>
        ) : minhasFotos.length > 0 ? (
          <>
            {/* Banner de novas fotos */}
            {novasMinhasFotos > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <Bell size={15} className="text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-700">
                  {novasMinhasFotos} nova{novasMinhasFotos !== 1 ? "s" : ""} foto{novasMinhasFotos !== 1 ? "s" : ""} encontrada{novasMinhasFotos !== 1 ? "s" : ""}!
                </span>
              </div>
            )}
            {usouIndex && (
              <div className="flex items-center gap-1.5 mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  ⚡ Busca instantânea
                </span>
                <span className="text-gray-300 text-xs">{minhasFotos.length} fotos encontradas</span>
              </div>
            )}
            <ScrollRow>
              {minhasFotos.map(id => (
                <div key={id} className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32">
                  <FotoCard id={id} />
                </div>
              ))}
            </ScrollRow>
            <Link href="/resultado"
              className="mt-3 inline-flex items-center gap-1.5 text-[#2E7DD1] text-xs font-semibold hover:underline">
              Ver todas as fotos encontradas <ChevronRight size={13} />
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow">
              <ScanFace size={24} className="text-white" />
            </div>
            {sessionStorage.getItem("faceDescriptor") ? (
              <>
                <p className="text-gray-400 text-sm font-medium">Nenhuma foto encontrada ainda</p>
                <p className="text-gray-300 text-xs">Aguarde um evento ser indexado</p>
              </>
            ) : (
              <>
                <p className="text-[#0D2B4E] font-semibold text-sm">Cadastre seu rosto</p>
                <p className="text-gray-400 text-xs max-w-xs">
                  Nossa IA encontra você automaticamente em todas as fotos dos eventos.
                </p>
                <Link href="/cadastrar-rosto"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow hover:opacity-90 transition">
                  <Scan size={14} /> Cadastrar rosto
                </Link>
              </>
            )}
          </div>
        )}
      </Secao>

      {/* ── ÚLTIMAS FOTOS ─────────────────────────────────────── */}
      <Secao
        icon={<Images size={17} />}
        titulo="Últimas fotos"
        cor="#7c3aed"
        href="/galeria"
      >
        {fotosRecentes.length > 0 ? (
          <ScrollRow>
            {fotosRecentes.map(id => (
              <div key={id} className="flex-shrink-0 w-28 h-28 sm:w-32 sm:h-32">
                <FotoCard id={id} />
              </div>
            ))}
          </ScrollRow>
        ) : (
          <div className="flex flex-col items-center py-8 gap-2">
            <Images size={28} className="text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhuma foto disponível</p>
          </div>
        )}
      </Secao>

      {/* ── ÚLTIMOS EVENTOS ───────────────────────────────────── */}
      <Secao
        icon={<CalendarDays size={17} />}
        titulo="Últimos eventos"
        cor="#d97706"
        href="/eventos"
      >
        {eventosRecentes.length > 0 ? (
          <ScrollRow>
            {eventosRecentes.map(ev => (
              <EventoCard key={ev.id} ev={ev} />
            ))}
          </ScrollRow>
        ) : (
          <div className="flex flex-col items-center py-8 gap-2">
            <CalendarDays size={28} className="text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhum evento disponível</p>
          </div>
        )}
      </Secao>

    </div>
  );
}
