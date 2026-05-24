"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MessageCircle, Check, X, Trash2, AlertCircle, Loader2, ChevronDown, Clock, CheckCircle } from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";
import type { Comentario, StatusComentario } from "@/app/api/comentarios/route";

interface ComentarioComEvento extends Comentario {
  eventoNome: string;
}

type Filtro = "pendente" | "aprovado" | "rejeitado" | "todos";

export default function AdminComentariosPage() {
  const [eventos,     setEventos]     = useState<EventoItem[]>([]);
  const [coments,     setComents]     = useState<ComentarioComEvento[]>([]);
  const [filtro,      setFiltro]      = useState<Filtro>("pendente");
  const [carregando,  setCarregando]  = useState(true);
  const [erro,        setErro]        = useState("");
  const [eventoFilter, setEventoFilter] = useState<string>("todos");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const evRes = await fetch("/api/eventos", { cache: "no-store" });
      const evs: EventoItem[] = await evRes.json();
      setEventos(Array.isArray(evs) ? evs : []);

      const candidatos = (Array.isArray(evs) ? evs : []).filter(e => e.folder_id);
      const todos: ComentarioComEvento[] = [];
      await Promise.all(candidatos.map(async (ev) => {
        try {
          const r = await fetch(`/api/comentarios?eventoId=${encodeURIComponent(ev.id)}&status=todos`, { cache: "no-store" });
          if (!r.ok) return;
          const lista: Comentario[] = await r.json();
          lista.forEach(c => todos.push({ ...c, eventoNome: ev.nome }));
        } catch {}
      }));
      todos.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
      setComents(todos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function moderar(c: ComentarioComEvento, status: StatusComentario) {
    setComents(prev => prev.map(x => x.id === c.id ? { ...x, status } : x)); // otimista
    try {
      const r = await fetch(`/api/comentarios?id=${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId: c.eventoId, status }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      carregar();
    }
  }

  async function deletar(c: ComentarioComEvento) {
    if (!confirm(`Deletar comentário de ${c.autor_nome}? Não dá pra desfazer.`)) return;
    setComents(prev => prev.filter(x => x.id !== c.id));
    try {
      const r = await fetch(`/api/comentarios?id=${encodeURIComponent(c.id)}&eventoId=${encodeURIComponent(c.eventoId)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      carregar();
    }
  }

  const filtrados = coments.filter(c => {
    if (eventoFilter !== "todos" && c.eventoId !== eventoFilter) return false;
    if (filtro === "todos") return true;
    return c.status === filtro;
  });

  const counts = {
    pendente:  coments.filter(c => c.status === "pendente").length,
    aprovado:  coments.filter(c => c.status === "aprovado").length,
    rejeitado: coments.filter(c => c.status === "rejeitado").length,
    todos:     coments.length,
  };

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MessageCircle size={24} className="text-[#145dff]" />
          <h1 className="text-2xl font-extrabold text-[#0D2B4E]">Moderar comentários</h1>
          {counts.pendente > 0 && (
            <span className="ml-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-extrabold">
              {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">Aprove o que vai pro público. Comentários pendentes ficam ocultos do site até serem aprovados.</p>
      </header>

      {erro && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {([
          { v: "pendente",  label: "Pendentes",  cor: "amber" },
          { v: "aprovado",  label: "Aprovados",  cor: "emerald" },
          { v: "rejeitado", label: "Rejeitados", cor: "gray" },
          { v: "todos",     label: "Todos",      cor: "blue" },
        ] as const).map(opt => {
          const active = filtro === opt.v;
          return (
            <button key={opt.v} onClick={() => setFiltro(opt.v)}
              className={`px-4 py-2 rounded-xl text-sm font-extrabold transition
                ${active ? "bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white shadow" : "bg-white border border-[#bfd0ec] text-[#061844] hover:border-[#145dff]"}`}>
              {opt.label} <span className={active ? "text-white/70" : "text-gray-400"}>{counts[opt.v]}</span>
            </button>
          );
        })}

        <div className="relative ml-auto">
          <select
            value={eventoFilter}
            onChange={e => setEventoFilter(e.target.value)}
            className="h-10 pl-3 pr-9 rounded-xl border border-[#bfd0ec] bg-white text-sm font-semibold text-[#061844] outline-none focus:border-[#145dff] appearance-none cursor-pointer">
            <option value="todos">Todos os eventos</option>
            {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 gap-2 text-[#145dff]">
          <Loader2 size={18} className="animate-spin" /> Carregando comentários...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={36} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {filtro === "pendente" ? "Nada pra moderar — tudo em dia." : "Nenhum comentário neste filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => (
            <div key={c.id} className="rounded-xl border border-[#dde8f7] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#145dff] to-[#7d3cff] text-white font-black flex items-center justify-center shrink-0 text-sm">
                  {(c.autor_nome[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <strong className="text-sm font-extrabold text-[#061844]">{c.autor_nome}</strong>
                    <span className="text-[11px] text-[#415d86] font-mono">{c.autor_email}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                    <span>{new Date(c.criado_em).toLocaleString("pt-BR")}</span>
                    <span>·</span>
                    <Link href={`/eventos/${c.eventoId}`} className="text-[#145dff] hover:underline font-semibold">{c.eventoNome}</Link>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <p className="text-sm text-[#15315c] leading-snug whitespace-pre-wrap break-words bg-[#f8fbff] rounded-lg p-3 border border-[#eef2f8]">
                {c.mensagem}
              </p>

              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-gray-400">
                  ❤️ {c.likes.length} curtida{c.likes.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  {c.status !== "aprovado" && (
                    <button onClick={() => moderar(c, "aprovado")}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold transition">
                      <Check size={14} strokeWidth={3} /> Aprovar
                    </button>
                  )}
                  {c.status !== "rejeitado" && (
                    <button onClick={() => moderar(c, "rejeitado")}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-extrabold transition">
                      <X size={14} strokeWidth={3} /> Rejeitar
                    </button>
                  )}
                  <button onClick={() => deletar(c)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-extrabold transition">
                    <Trash2 size={13} /> Deletar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusComentario }) {
  const conf = status === "aprovado"
    ? { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: <CheckCircle size={11} strokeWidth={3} />, label: "Aprovado" }
    : status === "rejeitado"
      ? { bg: "bg-gray-100 border-gray-200 text-gray-600", icon: <X size={11} strokeWidth={3} />, label: "Rejeitado" }
      : { bg: "bg-amber-50 border-amber-200 text-amber-700", icon: <Clock size={11} />, label: "Pendente" };
  return (
    <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-extrabold border shrink-0 ${conf.bg}`}>
      {conf.icon} {conf.label}
    </span>
  );
}
