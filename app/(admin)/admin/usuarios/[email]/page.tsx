"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, ScanFace, Images, Loader2,
  Calendar, Mail, ExternalLink, Check, Plus, Save, CheckCircle,
} from "lucide-react";
import Link from "next/link";

interface UsuarioInfo {
  email: string;
  nome: string;
  foto: string;
  thumb: string | null;
  temDescriptor: boolean;
  totalReferencias: number;
  totalFotosRastreio: number;
  referenciasRosto: string[];
  notificar_site: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface EventoMatch {
  eventoId: string;
  eventoNome: string;
  processadoEm: string;
  fotosIds: string[];      // candidatos da IA
  folderId?: string;       // pasta do evento (pra navegar todas as fotos)
  confirmadas?: string[];  // já salvas no _mf_ do usuário
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

  // ── Curadoria ──────────────────────────────────────────────
  // Seleção atual por evento (Set de fotoIds). Inicia com IA ∪ confirmadas.
  const [selPorEvento, setSelPorEvento] = useState<Record<string, Set<string>>>({});
  // Todas as fotos do evento (lazy — carrega ao clicar "Adicionar fotos")
  const [todasFotos, setTodasFotos] = useState<Record<string, { id: string; name: string }[]>>({});
  const [carregandoTodas, setCarregandoTodas] = useState(false);
  const [modoAdicionar, setModoAdicionar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoFlag, setSalvoFlag] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        // Carrega info do usuário
        const usRes = await fetch(`/api/usuarios?email=${encodeURIComponent(emailParam)}`);
        if (usRes.ok) {
          const u: UsuarioInfo | null = await usRes.json();
          setUsuario(u?.email ? u : null);
        }

        // Carrega lista de eventos para buscar matches
        const evRes = await fetch("/api/eventos");
        const evLista = evRes.ok ? await evRes.json() : [];

        // Confirmadas (o que ja esta no _mf_ do usuario)
        const mfRes = await fetch(`/api/meu/fotos?email=${encodeURIComponent(emailParam)}`).catch(() => null);
        const mfData = mfRes?.ok ? await mfRes.json() : null;
        const confirmadasPorEvento = new Map<string, string[]>();
        if (mfData?.eventos) {
          for (const e of mfData.eventos as { eventoId: string; fotoIds: string[] }[]) {
            confirmadasPorEvento.set(e.eventoId, e.fotoIds ?? []);
          }
        }

        // Para cada evento: candidatos da IA (matches) + confirmadas
        const evMatches: EventoMatch[] = [];
        const selInicial: Record<string, Set<string>> = {};
        await Promise.all(
          (evLista as { id: string; nome: string; folder_id?: string }[]).map(async (ev) => {
            try {
              let iaFotos: string[] = [];
              let processadoEm = "";
              const mRes = await fetch(`/api/matches?eventoId=${ev.id}`);
              if (mRes.ok) {
                const data = await mRes.json();
                const userMatch = data?.usuarios?.find(
                  (u: { email: string; fotosIds: string[] }) => u.email === emailParam
                );
                if (userMatch?.fotosIds?.length) { iaFotos = userMatch.fotosIds; processadoEm = data.processadoEm; }
              }
              const confirmadas = confirmadasPorEvento.get(ev.id) ?? [];
              // Só lista o evento se houver candidatos OU confirmadas
              if (iaFotos.length === 0 && confirmadas.length === 0) return;
              evMatches.push({
                eventoId: ev.id,
                eventoNome: ev.nome,
                processadoEm,
                fotosIds: iaFotos,
                folderId: ev.folder_id,
                confirmadas,
              });
              // Seleção inicial = IA ∪ confirmadas
              selInicial[ev.id] = new Set<string>([...iaFotos, ...confirmadas]);
            } catch { /**/ }
          })
        );

        evMatches.sort((a, b) => b.processadoEm.localeCompare(a.processadoEm));
        setEventos(evMatches);
        setSelPorEvento(selInicial);
        if (evMatches.length > 0) setEventoAtivo(evMatches[0].eventoId);
      } catch { /**/ }
      setCarregando(false);
    }
    carregar();
  }, [emailParam]);

  const eventoSelecionado = eventos.find(e => e.eventoId === eventoAtivo);
  const totalFotos = eventos.reduce((acc, e) => acc + (selPorEvento[e.eventoId]?.size ?? e.fotosIds.length), 0);

  const selAtual = selPorEvento[eventoAtivo] ?? new Set<string>();

  function toggleFoto(id: string) {
    setSelPorEvento(prev => {
      const atual = new Set(prev[eventoAtivo] ?? []);
      if (atual.has(id)) atual.delete(id); else atual.add(id);
      return { ...prev, [eventoAtivo]: atual };
    });
  }

  async function carregarTodasFotos() {
    if (!eventoSelecionado?.folderId) return;
    if (todasFotos[eventoAtivo]) { setModoAdicionar(true); return; }
    setCarregandoTodas(true);
    try {
      const r = await fetch(`/api/fotos?folderId=${encodeURIComponent(eventoSelecionado.folderId)}`, { cache: "no-store" });
      const data = await r.json();
      const lista = Array.isArray(data?.fotos) ? data.fotos : [];
      setTodasFotos(prev => ({ ...prev, [eventoAtivo]: lista }));
      setModoAdicionar(true);
    } catch { /**/ }
    finally { setCarregandoTodas(false); }
  }

  async function salvarSelecao() {
    if (!eventoSelecionado) return;
    setSalvando(true);
    try {
      const fotoIds = Array.from(selPorEvento[eventoAtivo] ?? []);
      await fetch("/api/meu/fotos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailParam,
          eventoId: eventoSelecionado.eventoId,
          eventoNome: eventoSelecionado.eventoNome,
          fotoIds,
          processadoEm: new Date().toISOString(),
          merge: false, // substitui a seleção daquele evento pela curada
        }),
      });
      // Atualiza confirmadas localmente
      setEventos(prev => prev.map(e => e.eventoId === eventoAtivo ? { ...e, confirmadas: fotoIds } : e));
      setSalvoFlag(true);
      setTimeout(() => setSalvoFlag(false), 2500);
    } catch { /**/ }
    finally { setSalvando(false); }
  }

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
              {usuario.totalReferencias >= 2 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ScanFace size={10} /> {usuario.totalReferencias} referencias
                </span>
              ) : usuario.totalReferencias === 1 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  <ScanFace size={10} /> 1 referencia
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                  <ScanFace size={10} /> Sem rosto
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                usuario.notificar_site
                  ? "bg-blue-50 text-[#2E7DD1] border-blue-100"
                  : "bg-gray-100 text-gray-500 border-gray-100"
              }`}>
                {usuario.notificar_site ? "Sininho ativo" : "Sininho inativo"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EFF5FF] text-[#1A4A80] border border-[#2E7DD1]/20">
                <Images size={10} /> {totalFotos} foto{totalFotos !== 1 ? "s" : ""} encontrada{totalFotos !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="font-bold text-[#0D2B4E] flex items-center gap-2">
              <ScanFace size={16} className="text-[#2E7DD1]" />
              Referencias do rosto
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Selfies salvas no perfil para comparar com o indice dos eventos.
            </p>
          </div>
          <span className="text-xs font-bold text-[#1A4A80] bg-[#EFF5FF] rounded-full px-2.5 py-1">
            {usuario.totalReferencias} descriptor{usuario.totalReferencias === 1 ? "" : "es"}
          </span>
        </div>
        {usuario.referenciasRosto?.length ? (
          <div className="flex flex-wrap gap-3">
            {usuario.referenciasRosto.map((foto, index) => (
              <img
                key={`${index}:${foto.slice(0, 24)}`}
                src={foto}
                alt=""
                className="h-24 w-24 rounded-2xl border border-gray-100 object-cover shadow-sm"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#F7FAFD] px-4 py-5 text-sm">
            <p className="font-semibold text-[#0D2B4E]">
              {usuario.temDescriptor ? "Ha descritor salvo, mas a selfie de referencia nao esta disponivel." : "Este usuario ainda precisa cadastrar o rosto."}
            </p>
            <p className="text-gray-400 mt-1">
              {usuario.temDescriptor ? "A busca pode funcionar, mas a revisao visual fica limitada." : "Sem referencia facial o motor nao consegue comparar as fotos dele."}
            </p>
          </div>
        )}
      </div>

      {/* Sem fotos */}
      {eventos.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Images size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-[#0D2B4E] mb-1">Nenhuma foto encontrada</p>
          <p className="text-gray-400 text-sm mb-4">
            Este usuário ainda não foi identificado em nenhum evento indexado.
          </p>
          <Link href="/admin/reconhecimento-servidor"
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
                onClick={() => { setEventoAtivo(ev.eventoId); setModoAdicionar(false); }}
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
                }`}>{selPorEvento[ev.eventoId]?.size ?? ev.fotosIds.length}</span>
              </button>
            ))}
          </div>

          {eventoSelecionado && (
            <>
              {/* Toolbar de curadoria */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-[#0D2B4E]">{selAtual.size}</span> selecionada{selAtual.size !== 1 ? "s" : ""} em <em>{eventoSelecionado.eventoNome}</em>
                  {eventoSelecionado.fotosIds.length > 0 && (
                    <span className="text-gray-400"> · {eventoSelecionado.fotosIds.length} sugeridas pela IA</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {eventoSelecionado.folderId && (
                    <button
                      onClick={() => modoAdicionar ? setModoAdicionar(false) : carregarTodasFotos()}
                      disabled={carregandoTodas}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2E7DD1] text-[#2E7DD1] text-xs font-bold hover:bg-[#EFF5FF] transition disabled:opacity-50"
                    >
                      {carregandoTodas ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {modoAdicionar ? "Ver só selecionadas" : "Adicionar fotos do evento"}
                    </button>
                  )}
                  <button
                    onClick={salvarSelecao}
                    disabled={salvando}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-[#2E7DD1] to-[#1A4A80] text-white text-xs font-extrabold shadow hover:shadow-md transition disabled:opacity-50"
                  >
                    {salvando ? <Loader2 size={13} className="animate-spin" /> : salvoFlag ? <CheckCircle size={13} /> : <Save size={13} />}
                    {salvando ? "Salvando…" : salvoFlag ? "Salvo!" : "Salvar seleção"}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mb-3">
                {modoAdicionar
                  ? "Clique nas fotos pra marcar/desmarcar. As marcadas (✓) viram as fotos desse usuário."
                  : "Estas são as fotos selecionadas. Clique pra desmarcar uma errada, ou use “Adicionar fotos do evento”."}
              </p>

              {/* Grade — em modo adicionar mostra TODAS; senão só as selecionadas */}
              {(() => {
                const lista = modoAdicionar
                  ? (todasFotos[eventoAtivo] ?? []).map(f => f.id)
                  : Array.from(selAtual);
                if (lista.length === 0) {
                  return <p className="text-sm text-gray-400 py-8 text-center">Nenhuma foto {modoAdicionar ? "no evento" : "selecionada"}.</p>;
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {lista.map(id => {
                      const sel = selAtual.has(id);
                      const ehIA = eventoSelecionado.fotosIds.includes(id);
                      return (
                        <div key={id}
                          className={`group relative rounded-2xl overflow-hidden shadow-sm transition-all cursor-pointer border-2 ${
                            sel ? "border-[#2E7DD1] ring-2 ring-[#2E7DD1]/30" : "border-transparent opacity-60 hover:opacity-100"}`}
                          onClick={() => toggleFoto(id)}>
                          <div className="aspect-[4/3] bg-[#EFF5FF]">
                            <img src={`/api/thumb?id=${id}&sz=400`} alt=""
                              className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          {/* Marca de seleção */}
                          <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center shadow ${
                            sel ? "bg-[#2E7DD1] text-white" : "bg-white/80 text-gray-400"}`}>
                            {sel ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                          </div>
                          {ehIA && (
                            <span className="absolute top-2 right-2 text-[8px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded">IA</span>
                          )}
                          {/* Ações */}
                          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={e => { e.stopPropagation(); setFotoSel(id); }}
                              className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-[#0D2B4E] hover:bg-white shadow"
                              title="Ampliar">
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
