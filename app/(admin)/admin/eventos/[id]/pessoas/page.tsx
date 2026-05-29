"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, ScanFace, CheckCircle, AlertCircle,
  Search, Plus, X, ChevronRight, Camera, UserCheck, Users,
} from "lucide-react";

interface ClusterPessoa {
  clusterId: string;
  descritor_medio: number[];
  fotos: string[];
  rostosDetectados: number;
}

interface PerfilResumo {
  email: string;
  nome: string;
  thumb?: string | null;
  temDescriptor: boolean;
  totalReferencias?: number;
}

interface EventoBasico {
  id: string;
  nome: string;
}

const LIMIAR_MATCH = 0.55;

function dist(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export default function PessoasDoEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventoId } = use(params);

  const [evento, setEvento] = useState<EventoBasico | null>(null);
  const [clusters, setClusters] = useState<ClusterPessoa[]>([]);
  const [usuarios, setUsuarios] = useState<PerfilResumo[]>([]);
  const [perfisDescriptors, setPerfisDescriptors] = useState<Record<string, number[][]>>({});
  const [atribuicoes, setAtribuicoes] = useState<Record<string, { email: string; nome: string; auto: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Modal
  const [modalCluster, setModalCluster] = useState<ClusterPessoa | null>(null);
  const [buscaUser, setBuscaUser] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Carrega tudo
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        // Eventos pra pegar nome
        const evRes = await fetch("/api/eventos", { cache: "no-store" });
        const evList = await evRes.json();
        const ev = Array.isArray(evList) ? evList.find((e: { id: string }) => e.id === eventoId) : null;
        if (!cancelado && ev) setEvento({ id: ev.id, nome: ev.nome });

        // Clusters
        const pRes = await fetch(`/api/pessoas?eventoId=${eventoId}`, { cache: "no-store" });
        const pData = await pRes.json();
        const cls: ClusterPessoa[] = Array.isArray(pData?.clusters) ? pData.clusters : [];
        if (!cancelado) {
          // Ordena por quantidade de fotos (mais ativos primeiro)
          cls.sort((a, b) => b.fotos.length - a.fotos.length);
          setClusters(cls);
        }

        // Usuários (admin)
        const uRes = await fetch("/api/usuarios", { cache: "no-store" });
        if (uRes.ok) {
          const uList: PerfilResumo[] = await uRes.json();
          if (!cancelado) setUsuarios(uList);

          // Pra cada user com descriptor, carrega os descritores completos pra fazer auto-match
          const comDesc = uList.filter(u => u.temDescriptor);
          const promessas = comDesc.map(async u => {
            try {
              const r = await fetch(`/api/perfil?email=${encodeURIComponent(u.email)}`);
              if (!r.ok) return null;
              const p = await r.json();
              const descs: number[][] = Array.isArray(p?.descriptors) && p.descriptors.length > 0
                ? p.descriptors
                : Array.isArray(p?.descriptor) && p.descriptor.length === 128
                  ? [p.descriptor]
                  : [];
              return { email: u.email, descs };
            } catch { return null; }
          });
          const results = await Promise.all(promessas);
          if (!cancelado) {
            const map: Record<string, number[][]> = {};
            for (const r of results) {
              if (r && r.descs.length > 0) map[r.email] = r.descs;
            }
            setPerfisDescriptors(map);
          }
        }
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [eventoId]);

  // Auto-detecta matches: pra cada cluster, qual user tem o descriptor mais próximo do centroide?
  useEffect(() => {
    if (clusters.length === 0 || Object.keys(perfisDescriptors).length === 0) return;
    const novo: Record<string, { email: string; nome: string; auto: boolean }> = {};
    for (const c of clusters) {
      let melhor: { email: string; d: number } | null = null;
      for (const [email, descs] of Object.entries(perfisDescriptors)) {
        for (const d of descs) {
          const dst = dist(c.descritor_medio, d);
          if (!melhor || dst < melhor.d) melhor = { email, d: dst };
        }
      }
      if (melhor && melhor.d < LIMIAR_MATCH) {
        const u = usuarios.find(x => x.email === melhor!.email);
        if (u) novo[c.clusterId] = { email: u.email, nome: u.nome, auto: true };
      }
    }
    setAtribuicoes(prev => ({ ...novo, ...prev })); // manuais sobrescrevem auto
  }, [clusters, perfisDescriptors, usuarios]);

  const stats = useMemo(() => {
    const total = clusters.length;
    const identificadas = Object.keys(atribuicoes).length;
    const restantes = total - identificadas;
    return { total, identificadas, restantes };
  }, [clusters, atribuicoes]);

  const usuariosFiltrados = useMemo(() => {
    const q = buscaUser.toLowerCase().trim();
    if (!q) return usuarios.slice(0, 50);
    return usuarios.filter(u =>
      (u.nome?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false)
    ).slice(0, 50);
  }, [usuarios, buscaUser]);

  function abrirModal(c: ClusterPessoa) {
    setModalCluster(c);
    setBuscaUser("");
    setNovoNome("");
    setNovoEmail("");
  }

  async function atribuir(email: string, nome: string) {
    if (!modalCluster || !evento) return;
    const c = modalCluster;
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/atribuir-pessoa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          nome,
          descritor_medio: c.descritor_medio,
          eventoId: evento.id,
          eventoNome: evento.nome,
          fotoIds: c.fotos,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || `Falha (${r.status})`);
      }

      // UI: marca como identificada
      setAtribuicoes(prev => ({ ...prev, [c.clusterId]: { email, nome, auto: false } }));

      // Se for user novo, adiciona ao roll local (pra usar em outros clusters da mesma sessao)
      if (!usuarios.find(u => u.email === email)) {
        setUsuarios(prev => [{ email, nome, temDescriptor: true }, ...prev]);
      }
      // Adiciona ao mapa de descritores em memoria (pra auto-match dos proximos clusters)
      setPerfisDescriptors(prev => ({
        ...prev,
        [email]: [...(prev[email] ?? []), c.descritor_medio].slice(0, 5),
      }));

      setModalCluster(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  function atribuirNovo() {
    const e = novoEmail.trim().toLowerCase();
    const n = novoNome.trim();
    if (!e || !n) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      alert("Email inválido");
      return;
    }
    atribuir(e, n);
  }

  return (
    <div className="max-w-[1280px] mx-auto p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/eventos/${eventoId}`}
            className="w-11 h-11 rounded-full border border-[#c4d6f4] bg-[#f2f7ff] text-[#102658] flex items-center justify-center hover:bg-[#e7efff] transition shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[28px] font-extrabold text-[#061844] tracking-tight leading-tight flex items-center gap-2">
              <ScanFace size={24} className="text-[#7C3AED]" /> Pessoas detectadas
            </h1>
            <p className="text-[#415d86] text-sm mt-0.5">
              {evento?.nome ?? "Carregando…"} — identifique manualmente quem é cada pessoa pra IA aprender
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      {!loading && clusters.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Pessoas únicas" value={stats.total} icon={<Users size={16} />} tone="neutral" />
          <StatCard label="Identificadas" value={stats.identificadas} icon={<UserCheck size={16} />} tone="ok" />
          <StatCard label="Pendentes" value={stats.restantes} icon={<AlertCircle size={16} />} tone="warn" />
        </div>
      )}

      {/* Estado vazio / loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-[#415d86]">
          <Loader2 size={20} className="animate-spin" /> Carregando…
        </div>
      )}
      {!loading && clusters.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
          <AlertCircle size={28} className="mx-auto mb-2" />
          <p className="font-extrabold">Nenhuma pessoa detectada ainda.</p>
          <p className="text-sm mt-1">Rode a indexação do evento primeiro em <strong>/admin/reconhecimento</strong>.</p>
        </div>
      )}

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      {/* Grid de clusters */}
      {!loading && clusters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map((c, i) => {
            const atrib = atribuicoes[c.clusterId];
            return (
              <ClusterCard
                key={c.clusterId}
                cluster={c}
                ordem={i + 1}
                atribuicao={atrib}
                onIdentificar={() => abrirModal(c)}
              />
            );
          })}
        </div>
      )}

      {/* Modal de identificação */}
      {modalCluster && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <header className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-[#061844] text-lg">Quem é essa pessoa?</h3>
                <p className="text-xs text-[#415d86] mt-0.5">
                  Aparece em {modalCluster.fotos.length} foto{modalCluster.fotos.length !== 1 ? "s" : ""} • {modalCluster.rostosDetectados} detecções
                </p>
              </div>
              <button onClick={() => setModalCluster(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={18} />
              </button>
            </header>

            {/* Previews da pessoa */}
            <div className="px-5 py-3 flex gap-2 overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: "none" }}>
              {modalCluster.fotos.slice(0, 6).map(fid => (
                <img
                  key={fid}
                  src={`/api/thumb?id=${fid}&sz=200`}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover shrink-0 border border-gray-200"
                />
              ))}
            </div>

            {/* Busca + lista de usuários */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={buscaUser}
                  onChange={e => setBuscaUser(e.target.value)}
                  placeholder="Buscar por nome ou email…"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#7C3AED]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
              {usuariosFiltrados.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">
                  Nenhum usuário encontrado com esse nome/email.
                </p>
              ) : (
                <div className="space-y-1">
                  {usuariosFiltrados.map(u => (
                    <button
                      key={u.email}
                      onClick={() => atribuir(u.email, u.nome)}
                      disabled={salvando}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#f5f0ff] transition text-left disabled:opacity-50"
                    >
                      {u.thumb ? (
                        <img src={u.thumb} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#2E7DD1] text-white flex items-center justify-center text-xs font-black">
                          {(u.nome?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#061844] text-sm truncate">{u.nome}</div>
                        <div className="text-[11px] text-[#415d86] truncate">{u.email}</div>
                      </div>
                      {u.temDescriptor && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                          tem selfie
                        </span>
                      )}
                      <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Form pra novo perfil */}
            <div className="border-t border-gray-100 p-5 bg-gray-50/50">
              <p className="text-xs font-bold text-[#061844] mb-2 flex items-center gap-1">
                <Plus size={12} /> Ou criar perfil novo:
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome completo"
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#7C3AED]"
                />
                <input
                  type="email"
                  value={novoEmail}
                  onChange={e => setNovoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#7C3AED]"
                />
              </div>
              <button
                onClick={atribuirNovo}
                disabled={salvando || !novoNome.trim() || !novoEmail.trim()}
                className="w-full h-9 rounded-lg bg-[#7C3AED] text-white font-extrabold text-sm hover:bg-[#6028d4] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {salvando ? "Salvando…" : "Criar e atribuir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sub-componentes ─────────────────────────── */

function StatCard({ label, value, icon, tone }: {
  label: string; value: number; icon: React.ReactNode;
  tone: "neutral" | "ok" | "warn";
}) {
  const cls = tone === "ok"
    ? "border-emerald-200 bg-emerald-50/50 text-emerald-700"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50/50 text-amber-700"
      : "border-[#dde8f7] bg-white text-[#061844]";
  return (
    <div className={`rounded-xl border ${cls} p-4 flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <div className="text-2xl font-black leading-none">{value}</div>
        <div className="text-[11px] font-semibold opacity-80 mt-1">{label}</div>
      </div>
    </div>
  );
}

function ClusterCard({ cluster, ordem, atribuicao, onIdentificar }: {
  cluster: ClusterPessoa;
  ordem: number;
  atribuicao?: { email: string; nome: string; auto: boolean };
  onIdentificar: () => void;
}) {
  const previews = cluster.fotos.slice(0, 4);

  return (
    <div className={`rounded-xl border p-3 transition shadow-sm
      ${atribuicao
        ? "border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-white"
        : "border-[#dde8f7] bg-white hover:shadow-md"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-[#415d86] uppercase tracking-wider">
          Pessoa #{ordem}
        </span>
        <span className="text-[10px] font-semibold text-[#415d86] bg-[#f2f7ff] px-2 py-0.5 rounded-full">
          {cluster.fotos.length} foto{cluster.fotos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid de previews */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {previews.map(fid => (
          <img
            key={fid}
            src={`/api/thumb?id=${fid}&sz=200`}
            alt=""
            className="aspect-square w-full rounded-md object-cover bg-gray-100"
            loading="lazy"
          />
        ))}
        {previews.length < 4 && Array.from({ length: 4 - previews.length }, (_, i) => (
          <div key={`empty-${i}`} className="aspect-square rounded-md bg-gray-50 grid place-items-center text-gray-300">
            <Camera size={16} />
          </div>
        ))}
      </div>

      {/* Status / ação */}
      {atribuicao ? (
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-[#061844] truncate">
              {atribuicao.nome}
              {atribuicao.auto && <span className="ml-1 text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">AUTO</span>}
            </div>
            <div className="text-[10px] text-[#415d86] truncate">{atribuicao.email}</div>
          </div>
          <button
            onClick={onIdentificar}
            className="text-[10px] font-bold text-[#415d86] hover:text-[#7C3AED] shrink-0"
          >
            mudar
          </button>
        </div>
      ) : (
        <button
          onClick={onIdentificar}
          className="w-full h-9 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#2E7DD1] text-white font-extrabold text-xs hover:brightness-105 transition flex items-center justify-center gap-1.5"
        >
          <ScanFace size={13} /> Identificar
        </button>
      )}
    </div>
  );
}
