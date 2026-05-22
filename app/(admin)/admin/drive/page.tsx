"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FolderOpen,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

type GaleriaStatus = "online" | "erro" | "sem_pasta";

interface DriveGaleria {
  eventoId: string;
  nome: string;
  pastaId: string;
  pastaNome: string | null;
  totalFotos: number;
  status: GaleriaStatus;
  motivo: string;
}

interface DriveGaleriasPayload {
  ok: boolean;
  drive: {
    ok: boolean;
    email: string | null;
    erro?: string;
  };
  fonteCatalogo: string;
  rootConfigurada: boolean;
  consultadoEm: string;
  galerias: DriveGaleria[];
}

function fmtDate(iso?: string | null) {
  if (!iso) return "Nao consultado";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function badge(status: GaleriaStatus) {
  if (status === "online") {
    return {
      label: "Online",
      classes: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle size={14} />,
    };
  }
  if (status === "sem_pasta") {
    return {
      label: "Sem pasta",
      classes: "bg-gray-100 text-gray-600",
      icon: <FolderOpen size={14} />,
    };
  }
  return {
    label: "Revisar",
    classes: "bg-red-100 text-red-700",
    icon: <AlertCircle size={14} />,
  };
}

export default function DrivePage() {
  const [dados, setDados] = useState<DriveGaleriasPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/admin/drive-galerias", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Falha ao testar o Google Drive.");
      setDados(data as DriveGaleriasPayload);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void carregar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [carregar]);

  const resumo = useMemo(() => {
    const galerias = dados?.galerias ?? [];
    return {
      online: galerias.filter((galeria) => galeria.status === "online").length,
      erro: galerias.filter((galeria) => galeria.status === "erro").length,
      semPasta: galerias.filter((galeria) => galeria.status === "sem_pasta").length,
      fotos: galerias.reduce((total, galeria) => total + (galeria.totalFotos || 0), 0),
    };
  }, [dados]);

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0D2B4E]">
            <HardDrive className="text-[#2E7DD1]" size={25} />
            Google Drive
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Estado real do token e das pastas usadas por cada evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={carregar}
            disabled={carregando}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition hover:border-[#2E7DD1]/40 hover:text-[#2E7DD1] disabled:opacity-50"
            title="Testar Drive novamente"
          >
            {carregando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Atualizar
          </button>
          <Link
            href="/admin/eventos"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2167AE] px-4 text-sm font-semibold text-white shadow transition hover:bg-[#19558F]"
          >
            <Plus size={15} />
            Evento com pasta
          </Link>
        </div>
      </header>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <section className={`rounded-2xl border p-5 shadow-sm ${
        dados?.drive.ok ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/60"
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${
              dados?.drive.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {dados?.drive.ok ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <div>
              <p className="font-bold text-[#0D2B4E]">
                {dados?.drive.ok ? "Drive conectado" : "Drive precisa de atencao"}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {dados?.drive.email ?? dados?.drive.erro ?? "Aguardando teste do token"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="rounded-lg bg-white/80 px-2.5 py-1">
              Catalogo: {dados?.fonteCatalogo ?? "carregando"}
            </span>
            <span className="rounded-lg bg-white/80 px-2.5 py-1">
              Raiz: {dados?.rootConfigurada ? "configurada" : "ausente"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1">
              <Clock size={11} />
              {fmtDate(dados?.consultadoEm)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard icon={<CheckCircle size={18} />} label="Galerias online" value={String(resumo.online)} tone="ok" />
        <ResumoCard icon={<AlertCircle size={18} />} label="Com erro" value={String(resumo.erro)} tone="erro" />
        <ResumoCard icon={<FolderOpen size={18} />} label="Sem pasta" value={String(resumo.semPasta)} tone="neutro" />
        <ResumoCard icon={<HardDrive size={18} />} label="Fotos cadastradas" value={String(resumo.fotos)} tone="drive" />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold text-[#0D2B4E]">Galerias do Drive</h2>
          <p className="text-xs text-gray-400">
            Cada linha testa a pasta cadastrada no evento e a capacidade de listar seus arquivos.
          </p>
        </div>

        {carregando && !dados ? (
          <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl bg-[#F7FAFD] text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin text-[#2E7DD1]" />
            Testando pastas...
          </div>
        ) : dados?.galerias.length ? (
          <div className="space-y-2.5">
            {dados.galerias.map((galeria) => (
              <GaleriaRow key={galeria.eventoId} galeria={galeria} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-[#F7FAFD] px-4 text-center">
            <FolderOpen size={22} className="mb-2 text-[#2E7DD1]" />
            <p className="text-sm font-bold text-[#0D2B4E]">Nenhum evento no catalogo</p>
            <p className="mt-1 text-xs text-gray-400">Cadastre um evento com pasta do Drive para testar a galeria.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function GaleriaRow({ galeria }: { galeria: DriveGaleria }) {
  const status = badge(galeria.status);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-[#F7FAFD] px-4 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F0FC] text-[#2E7DD1]">
          <FolderOpen size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#0D2B4E]">{galeria.nome}</p>
          <p className="truncate text-xs text-gray-500">
            {galeria.pastaNome || galeria.pastaId || "Sem pasta cadastrada"}
          </p>
          <p className={`mt-1 text-xs ${galeria.status === "erro" ? "font-semibold text-red-600" : "text-gray-400"}`}>
            {galeria.motivo}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="rounded-lg bg-white px-2.5 py-1 text-xs text-gray-500">
          {galeria.totalFotos} foto(s)
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.classes}`}>
          {status.icon}
          {status.label}
        </span>
      </div>
    </div>
  );
}

function ResumoCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "erro" | "neutro" | "drive";
}) {
  const classes = {
    ok: "bg-emerald-100 text-emerald-700",
    erro: "bg-red-100 text-red-700",
    neutro: "bg-gray-100 text-gray-600",
    drive: "bg-[#E6F0FC] text-[#2E7DD1]",
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${classes[tone]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-black text-[#0D2B4E]">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
