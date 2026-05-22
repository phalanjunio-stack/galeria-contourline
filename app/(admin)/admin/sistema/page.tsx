"use client";

import { useEffect, useState } from "react";
import { Server, Database, HardDrive, Brain, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface SistemaStatus {
  app: { nodeEnv: string; gitSha: string | null; version: string | null; now: string };
  env: Record<string, boolean>;
  services: {
    drive: { configured: boolean; ok: boolean };
    faceIndex: { configured: boolean; ok: boolean; eventosIndexados: number; rostosIndexados: number; ultimoIndice: string | null; erro?: string };
    faceServer: { configured: boolean; ok: boolean; status?: number; erro?: string };
  };
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}

export default function AdminSistemaPage() {
  const [data, setData] = useState<SistemaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  function carregar() {
    setLoading(true);
    fetch("/api/admin/sistema")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const id = window.setTimeout(carregar, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-[#2E7DD1]">
        <Loader2 size={20} className="animate-spin" />
        Carregando sistema...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0D2B4E]">
            <Server size={22} className="text-[#2E7DD1]" /> Sistema
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Versao, ambiente e status dos servicos.</p>
        </div>
        <button onClick={carregar} className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-[#2E7DD1] hover:bg-[#EFF5FF]">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Atualizar
        </button>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-[#0D2B4E]">Aplicacao</h2>
            <div className="space-y-3 text-sm">
              <Row label="Ambiente" value={data.app.nodeEnv} />
              <Row label="Versao" value={data.app.version ?? "package"} />
              <Row label="Commit" value={data.app.gitSha?.slice(0, 12) ?? "nao informado"} />
              <Row label="Servidor" value={new Date(data.app.now).toLocaleString("pt-BR")} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-[#0D2B4E]">Servicos</h2>
            <div className="space-y-3">
              <Service icon={HardDrive} title="Google Drive" ok={data.services.drive.ok} detail={data.services.drive.configured ? "Configurado" : "Sem pasta raiz"} />
              <Service icon={Database} title="Postgres pgvector" ok={data.services.faceIndex.ok} detail={`${data.services.faceIndex.eventosIndexados} eventos, ${data.services.faceIndex.rostosIndexados} rostos`} />
              <Service icon={Brain} title="Face server" ok={data.services.faceServer.ok} detail={data.services.faceServer.configured ? `HTTP ${data.services.faceServer.status ?? "-"}` : "Nao configurado"} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-[#0D2B4E]">Variaveis</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.env).map(([key, ok]) => (
                <StatusPill key={key} ok={ok} label={key} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#EFF5FF] px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-semibold text-[#0D2B4E]">{value}</span>
    </div>
  );
}

function Service({ icon: Icon, title, ok, detail }: { icon: React.ElementType; title: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#F8FBFF] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF5FF] text-[#2E7DD1]">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#0D2B4E]">{title}</p>
        <p className="truncate text-xs text-gray-400">{detail}</p>
      </div>
      <StatusPill ok={ok} label={ok ? "OK" : "Falha"} />
    </div>
  );
}
