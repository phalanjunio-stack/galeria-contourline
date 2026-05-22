"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Camera, Calendar, Settings, Trash2, Eye, Globe, Lock, CheckCircle, Loader2 } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

const statusBadge: Record<string, string> = {
  aberto:    "bg-emerald-100 text-emerald-700",
  privado:   "bg-amber-100 text-amber-700",
  encerrado: "bg-gray-100 text-gray-600",
};
const StatusIcon: Record<string, React.ReactNode> = {
  aberto:    <Globe size={12} />,
  privado:   <Lock size={12} />,
  encerrado: <CheckCircle size={12} />,
};

export default function AdminEventosPage() {
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eventos")
      .then((r) => r.json())
      .then((data) => setEventos(Array.isArray(data) ? data : []))
      .catch(() => setEventos([]))
      .finally(() => setLoading(false));
  }, []);

  async function remover(id: string) {
    if (!confirm("Remover este evento?")) return;
    await fetch(`/api/eventos?id=${id}`, { method: "DELETE" });
    setEventos((ev) => ev.filter((e) => e.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E]">Eventos</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? "Carregando..." : `${eventos.length} eventos cadastrados`}
          </p>
        </div>
        <Link href="/admin/eventos/novo"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
          <Plus size={16} /> Novo evento
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#2E7DD1]">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Carregando eventos do Drive...</span>
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center shadow">
              <Camera size={28} className="text-white" />
            </div>
            <p className="font-semibold text-[#0D2B4E]">Nenhum evento ainda</p>
            <p className="text-gray-400 text-sm">Crie seu primeiro evento</p>
            <Link href="/admin/eventos/novo"
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
              <Plus size={15} /> Novo evento
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#EFF5FF]">
                <th className="text-left px-6 py-3.5 text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Evento</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-[#1A4A80] uppercase tracking-wider hidden sm:table-cell">Data</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-[#1A4A80] uppercase tracking-wider hidden md:table-cell">Fotos</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3.5 text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {eventos.map((e) => (
                <tr key={e.id} className="hover:bg-[#EFF5FF]/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow">
                        <Camera size={15} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-[#0D2B4E] text-sm">{e.nome}</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {e.categoria && (
                            <span className="rounded-full bg-[#EFF5FF] px-2 py-0.5 text-[10px] font-semibold text-[#1A4A80]">
                              {e.categoria}
                            </span>
                          )}
                          {e.tags?.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                      <Calendar size={13} className="text-[#2E7DD1]" />
                      {new Date(e.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[#2E7DD1] font-semibold text-sm">{e.total_fotos} fotos</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {StatusIcon[e.status]} {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {e.folder_id && (
                        <Link href={`/eventos/${e.id}`}
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-[#EFF5FF] hover:text-[#2E7DD1] transition">
                          <Eye size={14} />
                        </Link>
                      )}
                      <Link href={`/admin/eventos/${e.id}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-[#EFF5FF] hover:text-[#2E7DD1] transition">
                        <Settings size={14} />
                      </Link>
                      <button
                        onClick={() => remover(e.id)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
