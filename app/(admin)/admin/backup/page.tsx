"use client";
import { useState, useRef } from "react";
import { Download, Upload, RefreshCw, CheckCircle, AlertTriangle, Database, Cloud, HardDrive } from "lucide-react";

interface BackupInfo {
  eventos: unknown[];
  from: string;
  total: number;
  ts: string;
}

export default function BackupPage() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pasteJson, setPasteJson] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportar(source: "drive" | "local" | "auto") {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/backup?source=${source}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro ao exportar backup");
      setInfo(data);
      setRestoreStatus(null);
    } catch (err) {
      setRestoreStatus({ ok: false, msg: err instanceof Error ? err.message : "Erro ao exportar backup" });
    } finally {
      setLoading(false);
    }
  }

  function baixar() {
    if (!info) return;
    const blob = new Blob([JSON.stringify(info.eventos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restaurar(json: string) {
    setRestoreStatus(null);
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch {
      setRestoreStatus({ ok: false, msg: "JSON inválido. Verifique o arquivo." });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const result = await r.json();
      if (result.ok) {
        setRestoreStatus({ ok: true, msg: `${result.total} eventos restaurados. Drive: ${result.savedDrive ? "✓" : "⚠ falhou"}` });
        setPasteJson("");
      } else {
        setRestoreStatus({ ok: false, msg: result.error ?? "Erro ao restaurar" });
      }
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const txt = ev.target?.result as string;
      restaurar(txt);
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0D2B4E]">Backup de Eventos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Exporte e restaure os dados dos eventos armazenados no Google Drive.
        </p>
      </div>

      {/* Exportar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-bold text-[#0D2B4E] flex items-center gap-2">
          <Download size={16} className="text-[#2E7DD1]" /> Exportar / Verificar
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Do Drive", source: "drive" as const, icon: <Cloud size={14} /> },
            { label: "Cache local", source: "local" as const, icon: <HardDrive size={14} /> },
            { label: "Automático", source: "auto" as const, icon: <RefreshCw size={14} /> },
          ].map(({ label, source, icon }) => (
            <button key={source} onClick={() => exportar(source)} disabled={loading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-gray-200 hover:border-[#2E7DD1] hover:bg-[#EFF5FF] transition text-[#0D2B4E] text-sm font-semibold disabled:opacity-50">
              {icon} {label}
            </button>
          ))}
        </div>

        {info && (
          <div className="rounded-xl bg-[#EFF5FF] p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#0D2B4E]">{info.total} eventos</span>
                <span className="text-gray-400 ml-2">— fonte: <strong>{info.from}</strong></span>
              </div>
              <button onClick={baixar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E7DD1] text-white rounded-lg text-xs font-bold hover:opacity-90 transition">
                <Download size={12} /> Baixar JSON
              </button>
            </div>
            <pre className="bg-white rounded-lg p-3 text-xs text-gray-600 overflow-auto max-h-48 border border-gray-100">
              {JSON.stringify(info.eventos, null, 2).slice(0, 2000)}{info.total > 3 ? "\n..." : ""}
            </pre>
          </div>
        )}
      </div>

      {/* Restaurar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-bold text-[#0D2B4E] flex items-center gap-2">
          <Upload size={16} className="text-[#2E7DD1]" /> Restaurar
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Upload de arquivo */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Enviar arquivo JSON de backup</p>
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#2E7DD1] hover:bg-[#EFF5FF] transition flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-[#2E7DD1] text-sm font-semibold">
              <Upload size={20} /> Selecionar arquivo
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFileChange} />
          </div>

          {/* Colar JSON */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Colar JSON diretamente</p>
            <textarea value={pasteJson} onChange={e => setPasteJson(e.target.value)}
              placeholder='[{"id":"evt1","nome":"..."}]'
              className="w-full h-24 rounded-xl border border-gray-200 text-xs p-2 font-mono resize-none focus:outline-none focus:border-[#2E7DD1]" />
            <button onClick={() => pasteJson && restaurar(pasteJson)} disabled={!pasteJson || loading}
              className="mt-2 w-full h-8 rounded-lg bg-[#2E7DD1] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-40">
              Restaurar JSON colado
            </button>
          </div>
        </div>

        {restoreStatus && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold ${restoreStatus.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {restoreStatus.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {restoreStatus.msg}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5"><Database size={14} /> Como funciona</div>
        <p>Os eventos ficam salvos em <code className="bg-amber-100 px-1 rounded">_index.json</code> no Google Drive e em cache local no servidor.</p>
        <p>Se os eventos sumiram: exporte do Drive para ver o que há lá, depois exporte do cache local. Use o maior como base para restaurar.</p>
        <p>Após restaurar, visite <strong>/admin/eventos</strong> para confirmar.</p>
      </div>
    </div>
  );
}
