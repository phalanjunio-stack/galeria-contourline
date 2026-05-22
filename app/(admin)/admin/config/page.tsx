"use client";
import { useEffect, useState } from "react";
import {
  Settings, CalendarClock, Clock, ListChecks, ToggleLeft, ToggleRight,
  Play, Loader2, CheckCircle, Zap, SlidersHorizontal,
} from "lucide-react";
import {
  DEFAULT_RECOGNITION_THRESHOLDS,
  lerRecognitionThresholdsLocal,
  salvarRecognitionThresholdsLocal,
  type RecognitionThresholds,
} from "@/lib/recognition-thresholds";

interface EventoItem {
  id: string; nome: string; folder_id?: string;
}

interface AutomacaoConfig {
  enabled: boolean;
  hora: string;
  eventos: "todos" | string[];
  ultimaExecucao: string | null;
  ultimoLog: string | null;
}

export default function AdminConfigPage() {
  const [eventos,      setEventos]      = useState<EventoItem[]>([]);
  const [automacao,    setAutomacao]    = useState<AutomacaoConfig | null>(null);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [cronRodando,  setCronRodando]  = useState(false);
  const [cronResultado, setCronResultado] = useState<{ totalNovosMatches: number; totalNotificacoes: number; duracao: number } | null>(null);
  const [thresholds,   setThresholds]   = useState<RecognitionThresholds>(DEFAULT_RECOGNITION_THRESHOLDS);
  const [threshSaved,  setThreshSaved]  = useState(false);

  useEffect(() => {
    setThresholds(lerRecognitionThresholdsLocal());

    fetch("/api/eventos")
      .then(r => r.ok ? r.json() : [])
      .then((data: EventoItem[]) => setEventos(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/automacao")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAutomacao(data); })
      .catch(() => {});
  }, []);

  async function salvarAutomacao(patch: Partial<AutomacaoConfig>) {
    if (!automacao) return;
    const nova = { ...automacao, ...patch };
    setAutomacao(nova);
    setSalvandoAuto(true);
    try {
      await fetch("/api/automacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nova),
      });
    } finally {
      setSalvandoAuto(false);
    }
  }

  async function executarCronAgora() {
    setCronRodando(true);
    setCronResultado(null);
    try {
      const r = await fetch("/api/automacao/executar", { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        setCronResultado({ totalNovosMatches: data.totalNovosMatches, totalNotificacoes: data.totalNotificacoes, duracao: data.duracao });
        setAutomacao(prev => prev ? { ...prev, ultimaExecucao: new Date().toISOString(), ultimoLog: data.log?.at(-1) ?? null } : prev);
      }
    } catch { /**/ } finally {
      setCronRodando(false);
    }
  }

  function aplicarThresholds(nova: RecognitionThresholds) {
    setThresholds(nova);
    salvarRecognitionThresholdsLocal(nova);
    setThreshSaved(true);
    setTimeout(() => setThreshSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
          <Settings className="text-[#2E7DD1]" size={26} /> Configurações
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Automação diária e parâmetros de reconhecimento facial.
        </p>
      </div>

      {/* ── Automação Diária ─────────────────────────────────────── */}
      {automacao ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-[#2E7DD1]" />
              <div>
                <h2 className="text-sm font-bold text-[#0D2B4E]">Automação Diária</h2>
                <p className="text-[11px] text-gray-400">Re-verifica usuários novos contra eventos já indexados</p>
              </div>
            </div>
            <button
              onClick={() => salvarAutomacao({ enabled: !automacao.enabled })}
              disabled={salvandoAuto}
              className="flex items-center gap-1.5 transition"
              title={automacao.enabled ? "Desativar automação" : "Ativar automação"}
            >
              {automacao.enabled
                ? <ToggleRight size={32} className="text-[#2E7DD1]" />
                : <ToggleLeft size={32} className="text-gray-300" />}
              <span className={`text-xs font-semibold ${automacao.enabled ? "text-[#2E7DD1]" : "text-gray-400"}`}>
                {automacao.enabled ? "Ativa" : "Inativa"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#F5F7FA] rounded-xl p-3 border border-gray-100">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 mb-2">
                <Clock size={11} /> Horário de execução
              </label>
              <input
                type="time"
                value={automacao.hora}
                onChange={e => salvarAutomacao({ hora: e.target.value })}
                className="w-full text-sm font-bold text-[#0D2B4E] bg-transparent border-none outline-none"
              />
            </div>
            <div className="bg-[#F5F7FA] rounded-xl p-3 border border-gray-100">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 mb-2">
                <ListChecks size={11} /> Eventos
              </label>
              <select
                value={automacao.eventos === "todos" ? "todos" : "selecionar"}
                onChange={e => salvarAutomacao({ eventos: e.target.value === "todos" ? "todos" : [] })}
                className="w-full text-sm font-bold text-[#0D2B4E] bg-transparent border-none outline-none"
              >
                <option value="todos">Todos os eventos</option>
                <option value="selecionar">Selecionar eventos</option>
              </select>
            </div>
          </div>

          {automacao.eventos !== "todos" && (
            <div className="mb-4 space-y-1.5 max-h-40 overflow-y-auto">
              {eventos.filter(e => e.folder_id).map(ev => {
                const selecionado = Array.isArray(automacao.eventos) && automacao.eventos.includes(ev.id);
                return (
                  <label key={ev.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F5F7FA] border border-gray-100 cursor-pointer hover:border-[#2E7DD1] transition">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => {
                        const atual = Array.isArray(automacao.eventos) ? automacao.eventos : [];
                        const novo = selecionado ? atual.filter(id => id !== ev.id) : [...atual, ev.id];
                        salvarAutomacao({ eventos: novo });
                      }}
                      className="accent-[#2E7DD1] w-3.5 h-3.5"
                    />
                    <span className="text-xs text-[#0D2B4E] font-medium truncate flex-1">{ev.nome}</span>
                  </label>
                );
              })}
            </div>
          )}

          {(automacao.ultimaExecucao || automacao.ultimoLog) && (
            <div className="bg-[#F5F7FA] rounded-xl border border-gray-100 px-4 py-3 mb-4 space-y-1">
              {automacao.ultimaExecucao && (
                <p className="text-[11px] text-gray-400">
                  Última execução:{" "}
                  <span className="font-semibold text-[#0D2B4E]">
                    {new Date(automacao.ultimaExecucao).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </p>
              )}
              {automacao.ultimoLog && (
                <p className="text-[11px] text-gray-500">{automacao.ultimoLog}</p>
              )}
            </div>
          )}

          {cronResultado && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4">
              <CheckCircle size={15} className="text-emerald-500 shrink-0" />
              <p className="text-emerald-700 text-xs font-semibold">
                {cronResultado.totalNovosMatches} novos matches · {cronResultado.totalNotificacoes} notificações enviadas · {cronResultado.duracao}s
              </p>
            </div>
          )}

          <button
            onClick={executarCronAgora}
            disabled={cronRodando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#2E7DD1] text-[#2E7DD1] text-sm font-semibold hover:bg-[#EFF5FF] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cronRodando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {cronRodando ? "Executando..." : "Executar automação agora"}
          </button>

          <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
            <Clock size={9} />
            Cron diário configurado para {automacao.hora} via Vercel Cron
            {!automacao.enabled && " (desativado)"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 flex items-center gap-3 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Carregando configurações de automação...</span>
        </div>
      )}

      {/* ── Limiar de Reconhecimento ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal size={18} className="text-[#2E7DD1]" />
          <h2 className="text-sm font-bold text-[#0D2B4E]">Limiar de Reconhecimento</h2>
          {threshSaved && (
            <span className="ml-auto flex items-center gap-1 text-emerald-600 text-xs font-semibold">
              <CheckCircle size={12} /> Salvo
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mb-5">
          Distância máxima aceita para considerar duas faces iguais. Valores menores = mais rigoroso. Salvo localmente neste navegador.
        </p>

        {([
          { key: "admin" as const, label: "Admin (indexação)", desc: "Limiar usado ao processar evento no painel admin. Menor = menos falsos positivos.", color: "text-purple-600" },
          { key: "usuario" as const, label: "Banner MinhasFotos", desc: "Limiar no banner da página inicial. Menor = menos fotos exibidas, mais precisas.", color: "text-[#2E7DD1]" },
          { key: "resultado" as const, label: "Página Resultado", desc: "Limiar na página de busca manual do usuário. Maior = mais fotos encontradas.", color: "text-emerald-600" },
        ] as const).map(({ key, label, desc, color }) => (
          <div key={key} className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs font-bold ${color}`}>{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.3}
                  max={0.8}
                  step={0.01}
                  value={thresholds[key]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) aplicarThresholds({ ...thresholds, [key]: v });
                  }}
                  className="w-16 text-xs font-bold text-center border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#2E7DD1]"
                />
                <Zap size={11} className="text-yellow-400" />
              </div>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.8}
              step={0.01}
              value={thresholds[key]}
              onChange={e => aplicarThresholds({ ...thresholds, [key]: parseFloat(e.target.value) })}
              className="w-full accent-[#2E7DD1]"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
          </div>
        ))}

        <button
          onClick={() => aplicarThresholds(DEFAULT_RECOGNITION_THRESHOLDS)}
          className="text-xs text-gray-400 hover:text-[#2E7DD1] hover:underline transition"
        >
          Restaurar padrões (0.45 / 0.50 / 0.60)
        </button>
      </div>
    </div>
  );
}
