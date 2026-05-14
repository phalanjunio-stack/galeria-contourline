"use client";
import { useEffect, useState } from "react";
import {
  Calendar, Camera, Users, ScanFace, Plus, TrendingUp, HardDrive,
  RefreshCw, Zap, AlertTriangle, Clock, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import Link from "next/link";

interface EventoItem {
  id: string; nome: string; data: string; status: string;
  folder_id?: string; total_fotos: number;
  reconhecimento_facial?: boolean; criado_em?: string;
}
interface UsuarioItem {
  email: string; nome: string; temDescriptor: boolean; criado_em: string;
}
interface AutomacaoConfig {
  enabled: boolean; ultimaExecucao: string | null; ultimoLog: string | null;
}
interface ReindexFlag {
  eventoId: string; eventoNome: string; novas: number; detectadoEm: string;
}

function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

const STATUS_COR: Record<string, string> = {
  aberto:    "text-emerald-600 bg-emerald-50 border border-emerald-100",
  privado:   "text-amber-600  bg-amber-50  border border-amber-100",
  encerrado: "text-gray-500   bg-gray-50   border border-gray-100",
};
const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto", privado: "Privado", encerrado: "Encerrado",
};

export default function AdminDashboard() {
  const [eventos,   setEventos]   = useState<EventoItem[]>([]);
  const [usuarios,  setUsuarios]  = useState<UsuarioItem[]>([]);
  const [automacao, setAutomacao] = useState<AutomacaoConfig | null>(null);
  const [flags,     setFlags]     = useState<ReindexFlag[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [executando, setExecutando] = useState(false);
  const [cronResult, setCronResult] = useState<"ok" | "erro" | null>(null);

  async function carregar() {
    const [ev, us, aut, fl] = await Promise.all([
      fetch("/api/eventos").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/usuarios").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/automacao").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/indexacao/flags").then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setEventos(Array.isArray(ev) ? ev : []);
    setUsuarios(Array.isArray(us) ? us : []);
    setAutomacao(aut);
    setFlags(Array.isArray(fl) ? fl : []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function executarCron() {
    setExecutando(true);
    setCronResult(null);
    try {
      const r = await fetch("/api/cron/processar");
      setCronResult(r.ok ? "ok" : "erro");
      // Recarrega automação após execução
      const aut = await fetch("/api/automacao").then(r => r.ok ? r.json() : null).catch(() => null);
      setAutomacao(aut);
    } catch {
      setCronResult("erro");
    }
    setExecutando(false);
    setTimeout(() => setCronResult(null), 4000);
  }

  // ── Métricas ─────────────────────────────────────────────────
  const totalFotos     = eventos.reduce((s, e) => s + (e.total_fotos ?? 0), 0);
  const totalDescriptor = usuarios.filter(u => u.temDescriptor).length;
  const eventosAtivos  = eventos.filter(e => e.status === "aberto");

  // "Fotos Processadas" = eventos com reconhecimento_facial habilitado
  const eventosIA      = eventos.filter(e => e.reconhecimento_facial);
  const fotosIA        = eventosIA.reduce((s, e) => s + e.total_fotos, 0);
  const pctIA          = totalFotos > 0 ? Math.round((fotosIA / totalFotos) * 100) : 0;

  // Novos este mês
  const agora = new Date();
  function destesMes(iso?: string) {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  }
  const eventosMes  = eventos.filter(e => destesMes(e.criado_em)).length;
  const usuariosMes = usuarios.filter(u => destesMes(u.criado_em)).length;

  // Eventos mais recentes para lista
  const eventosRecentes = [...eventos]
    .sort((a, b) => (b.criado_em ?? b.data ?? "").localeCompare(a.criado_em ?? a.data ?? ""))
    .slice(0, 5);

  const stats = [
    {
      label: "Total de Eventos",
      value: fmt(eventos.length),
      icon: Calendar,
      sub: eventosMes > 0 ? `+${eventosMes} este mês` : `${eventosAtivos.length} abertos`,
      subColor: "text-emerald-600",
    },
    {
      label: "Total de Fotos",
      value: fmt(totalFotos),
      icon: Camera,
      sub: `${eventosAtivos.length} evento${eventosAtivos.length !== 1 ? "s" : ""} ativo${eventosAtivos.length !== 1 ? "s" : ""}`,
      subColor: "text-[#2E7DD1]",
    },
    {
      label: "Cadastros",
      value: fmt(usuarios.length),
      icon: Users,
      sub: usuariosMes > 0 ? `+${usuariosMes} novos este mês` : `${totalDescriptor} com rosto`,
      subColor: "text-emerald-600",
    },
    {
      label: "Fotos Processadas",
      value: fmt(fotosIA),
      icon: ScanFace,
      sub: `${pctIA}% do total · ${eventosIA.length} eventos`,
      subColor: "text-[#2E7DD1]",
    },
  ];

  // ── Skeleton ────────────────────────────────────────────────
  if (loading) return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#0D2B4E]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral da Galeria Contourline</p>
        </div>
        <div className="h-10 w-36 rounded-xl bg-gray-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-64 animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-64 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#0D2B4E]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral da Galeria Contourline</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-[#2E7DD1] hover:border-[#2E7DD1]/40 transition"
            title="Recarregar dados">
            <RefreshCw size={15} />
          </button>
          <Link href="/admin/eventos/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
            <Plus size={16} /> Novo evento
          </Link>
        </div>
      </div>

      {/* Banner flags (fotos novas detectadas pelo cron) */}
      {flags.length > 0 && (
        <div className="mb-6 flex items-center gap-3 px-5 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-semibold text-sm">
              {flags.length} evento{flags.length !== 1 ? "s" : ""} com fotos novas aguardando reindexação
            </p>
            <p className="text-amber-600 text-xs mt-0.5">
              {flags.map(f => `${f.eventoNome} (+${f.novas})`).join(" · ")}
            </p>
          </div>
          <Link href="/admin/reconhecimento"
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition">
            Indexar agora
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, sub, subColor }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow">
                <Icon size={18} className="text-white" />
              </div>
              <TrendingUp size={14} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-[#0D2B4E]">{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            <p className={`text-xs font-semibold mt-1 ${subColor}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Eventos recentes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-[#0D2B4E]">Eventos recentes</h2>
            <Link href="/admin/eventos" className="text-[#2E7DD1] text-xs font-semibold hover:underline">
              Ver todos
            </Link>
          </div>

          {eventosRecentes.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2 text-center">
              <Calendar size={32} className="text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhum evento criado ainda</p>
              <Link href="/admin/eventos/novo"
                className="mt-2 px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold shadow hover:opacity-90 transition">
                Criar primeiro evento
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {eventosRecentes.map((e) => {
                const flag = flags.find(f => f.eventoId === e.id);
                return (
                  <Link key={e.id} href={`/admin/eventos`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#EFF5FF] transition group">
                    <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow">
                      <Camera size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-[#0D2B4E] text-sm truncate">{e.nome}</p>
                        {e.reconhecimento_facial && (
                          <span title="Reconhecimento facial ativo">
                            <ScanFace size={12} className="text-[#2E7DD1] shrink-0" />
                          </span>
                        )}
                        {flag && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold shrink-0">
                            +{flag.novas} novas
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {fmt(e.total_fotos)} fotos
                        {e.data ? ` · ${new Date(e.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize shrink-0 ${STATUS_COR[e.status] ?? STATUS_COR.encerrado}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel direito */}
        <div className="space-y-4">
          {/* Google Drive / Cron */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={18} className="text-[#2E7DD1]" />
              <h2 className="font-bold text-[#0D2B4E]">Google Drive</h2>
            </div>

            <div className="space-y-2 mb-4">
              {/* Última execução do cron */}
              <div className="flex items-center justify-between p-3 bg-[#EFF5FF] rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-[#0D2B4E]">Última sincronização</p>
                  <p className="text-[#2E7DD1] text-xs flex items-center gap-1">
                    <Clock size={10} /> {tempoRelativo(automacao?.ultimaExecucao)}
                  </p>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${automacao?.ultimaExecucao ? "bg-emerald-500" : "bg-gray-300"}`} />
              </div>

              {/* Fotos processadas com barra */}
              <div className="p-3 bg-[#EFF5FF] rounded-xl">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#0D2B4E] font-semibold">Reconhecimento IA</span>
                  <span className="text-[#2E7DD1] font-bold">{pctIA}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full gradient-primary transition-all duration-700"
                    style={{ width: `${pctIA}%` }} />
                </div>
                <p className="text-gray-400 text-[10px] mt-1">
                  {eventosIA.length} de {eventos.length} eventos indexados
                </p>
              </div>

              {/* Último log do cron */}
              {automacao?.ultimoLog && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-semibold mb-0.5">Último log</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{automacao.ultimoLog}</p>
                </div>
              )}
            </div>

            {/* Usuários com rosto */}
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl mb-4">
              <ScanFace size={14} className="text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-700 font-semibold">
                {totalDescriptor} de {usuarios.length} usuários com rosto cadastrado
              </span>
            </div>

            <div className="space-y-2">
              <Link href="/admin/drive"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 transition shadow">
                <HardDrive size={15} /> Gerenciar Drive
              </Link>

              {/* Executar cron agora */}
              <button onClick={executarCron} disabled={executando}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-[#2E7DD1] text-[#2E7DD1] font-semibold text-sm hover:bg-[#EFF5FF] transition disabled:opacity-50">
                {executando
                  ? <><Loader2 size={14} className="animate-spin" /> Executando...</>
                  : cronResult === "ok"
                  ? <><CheckCircle size={14} className="text-emerald-500" /> Concluído!</>
                  : cronResult === "erro"
                  ? <><XCircle size={14} className="text-red-500" /> Erro ao executar</>
                  : <><Zap size={14} /> Executar cron agora</>}
              </button>

              <Link href="/admin/eventos/novo"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 font-semibold text-sm hover:bg-gray-50 transition">
                <Plus size={15} /> Novo evento
              </Link>
            </div>
          </div>

          {/* Atalhos rápidos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-[#0D2B4E] text-sm mb-3">Ações rápidas</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/admin/reconhecimento", icon: ScanFace, label: "Reconhecimento IA" },
                { href: "/admin/reconhecimento-servidor", icon: ScanFace, label: "Reconhecimento (Servidor)" },
                { href: "/admin/usuarios",       icon: Users,    label: "Usuários"           },
                { href: "/admin/fotos",          icon: Camera,   label: "Galeria"            },
                { href: "/admin/drive",          icon: HardDrive, label: "Drive"             },
              ].map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:border-[#2E7DD1]/30 hover:bg-[#EFF5FF] transition text-center group">
                  <Icon size={18} className="text-[#2E7DD1] group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-[#0D2B4E] leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
