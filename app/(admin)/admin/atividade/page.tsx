"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Loader2, Calendar, User, Download, CheckCircle } from "lucide-react";

interface Atividade {
  ts: string;
  tipo: string;
  email?: string;
  nome?: string;
  detalhes?: Record<string, unknown>;
}

const TIPOS_LABEL: Record<string, { label: string; icon: React.ReactNode; cor: string }> = {
  "evento.criado":      { label: "Evento criado",      icon: <Calendar size={13} />, cor: "bg-blue-50 text-blue-700 border-blue-200" },
  "evento.editado":     { label: "Evento editado",     icon: <Calendar size={13} />, cor: "bg-blue-50 text-blue-700 border-blue-200" },
  "evento.removido":    { label: "Evento removido",    icon: <Calendar size={13} />, cor: "bg-red-50 text-red-700 border-red-200" },
  "foto.confirmada":    { label: "Foto confirmada",    icon: <CheckCircle size={13} />, cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "foto.baixada":       { label: "Foto baixada",       icon: <Download size={13} />, cor: "bg-violet-50 text-violet-700 border-violet-200" },
  "perfil.cadastrado":  { label: "Perfil cadastrado",  icon: <User size={13} />, cor: "bg-amber-50 text-amber-700 border-amber-200" },
  "indexacao.iniciada": { label: "Indexacao iniciada", icon: <Activity size={13} />, cor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

function fmtRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `ha ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `ha ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `ha ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AdminAtividadePage() {
  const [lista, setLista] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  function carregar() {
    setLoading(true);
    fetch(`/api/admin/atividade?limite=200${filtro ? `&tipo=${filtro}` : ""}`)
      .then((r) => r.json())
      .then((d) => setLista(d.atividades ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const id = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const tipos = Array.from(new Set(lista.map((item) => item.tipo)));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
            <Activity size={22} className="text-[#2E7DD1]" /> Atividade
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Ultimas {lista.length} acoes no sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0D2B4E] focus:border-[#2E7DD1] outline-none"
          >
            <option value="">Todas as acoes</option>
            {Object.entries(TIPOS_LABEL).map(([tipo, info]) => <option key={tipo} value={tipo}>{info.label}</option>)}
            {tipos.filter((tipo) => !TIPOS_LABEL[tipo]).map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
          <button onClick={carregar} className="h-10 px-4 rounded-xl border border-gray-200 text-[#2E7DD1] hover:bg-[#EFF5FF] text-sm font-semibold flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#2E7DD1]">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Carregando...</span>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Activity size={32} className="text-gray-300" />
            <p className="text-gray-400 text-sm">Nenhuma atividade registrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lista.map((atividade, index) => {
              const info = TIPOS_LABEL[atividade.tipo] ?? { label: atividade.tipo, icon: <Activity size={13} />, cor: "bg-gray-50 text-gray-700 border-gray-200" };
              return (
                <div key={`${atividade.ts}-${index}`} className="px-5 py-3 flex items-center gap-3 hover:bg-[#EFF5FF]/30">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${info.cor}`}>
                    {info.icon} {info.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#0D2B4E] truncate">
                      {atividade.nome || atividade.email || <span className="text-gray-400">sistema</span>}
                      {atividade.detalhes && Object.keys(atividade.detalhes).length > 0 && (
                        <span className="text-gray-400 text-xs ml-2">
                          {Object.entries(atividade.detalhes).map(([key, value]) => `${key}: ${String(value)}`).join(" - ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtRelativo(atividade.ts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
