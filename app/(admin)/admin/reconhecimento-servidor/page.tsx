"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Images,
  Loader2,
  Play,
  RefreshCw,
  ScanFace,
  Server,
  Settings2,
  UserRoundCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

interface EventoItem {
  id: string;
  nome: string;
  data: string;
  folder_id?: string;
  total_fotos: number;
  status: string;
}

interface JobStatus {
  jobId: string;
  eventoId: string;
  eventoNome: string;
  folderId: string;
  status: "running" | "done" | "error";
  fase: string;
  iniciadoEm: string;
  terminadoEm?: string;
  fotosProcessadas: number;
  fotosTotal: number;
  fotosComRosto: number;
  rostosDetectados: number;
  usuariosCadastrados: number;
  matches: number;
  notificacoes?: number;
  erro: string | null;
}

interface PreviewFace {
  id: string;
  ordem: number;
  score: number | null;
  cropUrl: string;
}

interface PreviewPhoto {
  fotoId: string;
  rostos: PreviewFace[];
}

interface FacePreview {
  eventoId: string;
  eventoNome: string;
  totalFotos: number;
  fotosComRosto: number;
  rostosDetectados: number;
  indexedAt: string;
  fotos: PreviewPhoto[];
}

interface MatchUsuario {
  email: string;
  nome: string;
  fotosIds: string[];
  thumbUrl?: string;
}

interface MatchHistory {
  eventoId: string;
  eventoNome: string;
  processadoEm: string;
  totalFotos: number;
  fotosComRosto: number;
  usuarios: MatchUsuario[];
}

interface AutoIndexEvento {
  eventoId: string;
  nome: string;
  status: "ok" | "erro" | "ignorado" | "indexando" | "indexado";
  motivo: string;
  jobId?: string;
  matches?: number;
  fotosComRosto?: number;
}

interface AutoIndexCiclo {
  iniciadoEm: string;
  terminadoEm: string | null;
  pulado: boolean;
  erro: string | null;
  eventosTotal: number;
  perfisProntos: number;
  eventos: AutoIndexEvento[];
}

interface MotorStatus {
  ok: boolean;
  faceServer: {
    configured: boolean;
    online: boolean;
    authOk: boolean;
    uptime: number | null;
    erro?: string;
  };
  autoIndex: {
    supported: boolean;
    enabled: boolean | null;
    intervalMin: number | null;
    catalogoRemoto: boolean | null;
    iniciadoEm: string | null;
    rodando: boolean;
    ultimoCiclo: AutoIndexCiclo | null;
    erro?: string;
  };
  pgvector: {
    configured: boolean;
    ok: boolean;
    eventosIndexados: number;
    rostosIndexados: number;
    ultimoIndice: string | null;
    erro?: string;
  };
  drive: {
    configured: boolean;
    ok: boolean;
    email: string | null;
    erro?: string;
  };
  perfis: {
    total: number;
    comRosto: number;
  };
  notificacoes: {
    siteUrlConfigurada: boolean;
    secretConfigurado: boolean;
  };
}

const STORAGE_KEY = "indexar_remoto_jobs_v1";

type JobsStore = Record<string, string>;

const FASE_LABEL: Record<string, string> = {
  iniciando: "Iniciando",
  listando_fotos: "Listando fotos do Drive",
  recuperando_progresso: "Verificando progresso anterior",
  detectando_rostos: "Detectando rostos",
  fazendo_matches: "Comparando perfis cadastrados",
  salvando_matches: "Salvando resultados",
  clusterizando: "Agrupando rostos",
  salvando_pgvector: "Atualizando pgvector",
  notificando: "Criando notificacoes",
  concluido: "Concluido",
};

function lerJobsLocal(): JobsStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function salvarJobLocal(eventoId: string, jobId: string) {
  const atual = lerJobsLocal();
  atual[eventoId] = jobId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atual));
}

function removerJobLocal(eventoId: string) {
  const atual = lerJobsLocal();
  delete atual[eventoId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atual));
}

function fmtDate(iso?: string | null) {
  if (!iso) return "Ainda nao registrado";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtUptime(seconds?: number | null) {
  if (!seconds) return "Online";
  const minutos = Math.floor(seconds / 60);
  if (minutos < 60) return `${minutos} min online`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min online`;
}

export default function ReconhecimentoServidor() {
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [eventoSel, setEventoSel] = useState("");
  const [motor, setMotor] = useState<MotorStatus | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobStatus>>({});
  const [preview, setPreview] = useState<FacePreview | null>(null);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchHistory | null>(null);
  const [historico, setHistorico] = useState<MatchHistory[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoEvento, setCarregandoEvento] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const eventoAtual = useMemo(
    () => eventos.find((evento) => evento.id === eventoSel) ?? null,
    [eventos, eventoSel]
  );

  const carregarHistorico = useCallback(async (lista: EventoItem[]) => {
    const registros = await Promise.all(
      lista
        .filter((evento) => evento.folder_id)
        .map(async (evento) => {
          const res = await fetch(`/api/matches?eventoId=${encodeURIComponent(evento.id)}`).catch(() => null);
          if (!res?.ok) return null;
          const data = await res.json().catch(() => null);
          if (!data?.eventoId || !Array.isArray(data?.usuarios)) return null;
          return data as MatchHistory;
        })
    );
    setHistorico(
      registros
        .filter((item): item is MatchHistory => item !== null)
        .sort((a, b) => b.processadoEm.localeCompare(a.processadoEm))
        .slice(0, 6)
    );
  }, []);

  const carregarResumo = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [eventosRes, motorRes] = await Promise.all([
        fetch("/api/eventos"),
        fetch("/api/admin/motor-ia"),
      ]);
      const eventosData = eventosRes.ok ? await eventosRes.json() : [];
      const lista = Array.isArray(eventosData) ? eventosData : eventosData?.eventos ?? [];
      setEventos(lista);
      setEventoSel((atual) =>
        atual && lista.some((evento: EventoItem) => evento.id === atual)
          ? atual
          : lista.find((evento: EventoItem) => evento.folder_id)?.id ?? ""
      );
      setMotor(motorRes.ok ? await motorRes.json() : null);
      await carregarHistorico(lista);
    } catch (err) {
      setErro(`Falha ao carregar painel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCarregando(false);
    }
  }, [carregarHistorico]);

  const carregarEvento = useCallback(async (eventoId: string) => {
    if (!eventoId) {
      setPreview(null);
      setMatches(null);
      return;
    }

    setCarregandoEvento(true);
    try {
      const [previewRes, matchesRes] = await Promise.all([
        fetch(`/api/indexacao/rostos?eventoId=${encodeURIComponent(eventoId)}`),
        fetch(`/api/matches?eventoId=${encodeURIComponent(eventoId)}`),
      ]);
      const previewData = previewRes.ok ? await previewRes.json() : null;
      const matchesData = matchesRes.ok ? await matchesRes.json() : null;
      setPreview(previewData?.preview ?? null);
      setPreviewSource(typeof previewData?.source === "string" ? previewData.source : null);
      setMatches(matchesData?.eventoId ? matchesData as MatchHistory : null);
    } catch {
      setPreview(null);
      setMatches(null);
    } finally {
      setCarregandoEvento(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void carregarResumo();
    }, 0);
    return () => window.clearTimeout(id);
  }, [carregarResumo]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void carregarEvento(eventoSel);
    }, 0);
    return () => window.clearTimeout(id);
  }, [carregarEvento, eventoSel]);

  const fetchStatus = useCallback(async (eventoId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/indexar-remoto/status?jobId=${encodeURIComponent(jobId)}`);
      if (res.status === 404) {
        removerJobLocal(eventoId);
        setJobs((atual) => {
          const proximo = { ...atual };
          delete proximo[eventoId];
          return proximo;
        });
        return;
      }
      if (!res.ok) return;
      const status: JobStatus = await res.json();
      setJobs((atual) => ({ ...atual, [eventoId]: status }));
      if (status.status === "done") {
        void carregarEvento(eventoId);
      }
    } catch (err) {
      console.warn("[motor-ia] poll falhou", err);
    }
  }, [carregarEvento]);

  useEffect(() => {
    const tick = async () => {
      await Promise.all(
        Object.entries(lerJobsLocal()).map(([eventoId, jobId]) => fetchStatus(eventoId, jobId))
      );
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function iniciar() {
    if (!eventoAtual?.folder_id) {
      setErro("Escolha um evento com pasta no Drive.");
      return;
    }

    setIniciando(true);
    setErro(null);
    try {
      const res = await fetch("/api/indexar-remoto/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: eventoAtual.id,
          eventoNome: eventoAtual.nome,
          folderId: eventoAtual.folder_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar indexacao.");
      salvarJobLocal(eventoAtual.id, data.jobId);
      await fetchStatus(eventoAtual.id, data.jobId);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setIniciando(false);
    }
  }

  function dispensar(eventoId: string) {
    removerJobLocal(eventoId);
    setJobs((atual) => {
      const proximo = { ...atual };
      delete proximo[eventoId];
      return proximo;
    });
  }

  const jobsVisiveis = Object.values(jobs).sort((a, b) => b.iniciadoEm.localeCompare(a.iniciadoEm));
  const selecionadoIndexado = Boolean(preview?.rostosDetectados);
  const checklist = [
    {
      label: "Face server online",
      ok: Boolean(motor?.faceServer.online),
      detail: motor?.faceServer.erro ?? fmtUptime(motor?.faceServer.uptime),
    },
    {
      label: "Autenticacao entre servicos",
      ok: Boolean(motor?.faceServer.authOk),
      detail: motor?.faceServer.authOk ? "Segredo aceito" : "Confira FACE_SERVER_SECRET e SERVER_SECRET",
    },
    {
      label: "Postgres com pgvector",
      ok: Boolean(motor?.pgvector.ok),
      detail: motor?.pgvector.ok
        ? `${motor.pgvector.eventosIndexados} evento(s) no indice`
        : motor?.pgvector.erro ?? "DATABASE_URL indisponivel",
    },
    {
      label: "Google Drive",
      ok: Boolean(motor?.drive.ok),
      detail: motor?.drive.email ?? motor?.drive.erro ?? "Drive nao testado",
    },
    {
      label: "Autoindexacao",
      ok: Boolean(motor?.autoIndex.supported && motor.autoIndex.enabled),
      detail: motor?.autoIndex.enabled
        ? `Ciclo a cada ${motor.autoIndex.intervalMin ?? "?"} min`
        : motor?.autoIndex.erro ?? "AUTO_INDEX_ENABLED precisa ser 1",
    },
    {
      label: "Pessoas com rosto cadastrado",
      ok: Boolean(motor?.perfis.comRosto),
      detail: `${motor?.perfis.comRosto ?? 0} de ${motor?.perfis.total ?? 0} perfis prontos`,
    },
    {
      label: "Sininho automatico",
      ok: Boolean(motor?.notificacoes.siteUrlConfigurada && motor?.notificacoes.secretConfigurado),
      detail:
        motor?.notificacoes.siteUrlConfigurada && motor?.notificacoes.secretConfigurado
          ? "Notificacoes internas prontas"
          : "Confira URL do site e segredo do face server",
    },
    {
      label: "Evento selecionado com pasta",
      ok: Boolean(eventoAtual?.folder_id),
      detail: eventoAtual ? `${eventoAtual.total_fotos} foto(s) cadastradas` : "Selecione um evento",
    },
    {
      label: "Indice do evento selecionado",
      ok: selecionadoIndexado,
      detail: selecionadoIndexado
        ? `${preview?.rostosDetectados ?? 0} rosto(s) salvos`
        : "Indexe ou reindexe este evento",
    },
  ];

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0D2B4E]">
            <ScanFace size={26} className="text-[#2E7DD1]" />
            Motor de Reconhecimento IA
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Operacao da indexacao facial, busca vetorial e notificacoes do site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={carregarResumo}
            disabled={carregando}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition hover:border-[#2E7DD1]/40 hover:text-[#2E7DD1] disabled:opacity-50"
          >
            {carregando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Atualizar
          </button>
          <Link
            href="/admin/config"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E7DD1] px-4 text-sm font-semibold text-[#2E7DD1] transition hover:bg-[#EFF5FF]"
          >
            <Settings2 size={15} />
            Limiares
          </Link>
        </div>
      </header>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-[#0D2B4E]">Estado do motor</h2>
            <p className="text-xs text-gray-400">
              {motor?.ok ? "Estrutura pronta para indexar e avisar pessoas." : "Ha itens que precisam de ajuste."}
            </p>
          </div>
          <StatusBadge ok={Boolean(motor?.ok)} label={motor?.ok ? "Pronto" : "Revisar"} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HealthItem
            icon={<Server size={17} />}
            label="Face server"
            value={motor?.faceServer.online ? "Online" : "Offline"}
            ok={Boolean(motor?.faceServer.online && motor?.faceServer.authOk)}
            detail={motor?.faceServer.authOk ? fmtUptime(motor?.faceServer.uptime) : motor?.faceServer.erro}
          />
          <HealthItem
            icon={<Database size={17} />}
            label="Pgvector"
            value={motor?.pgvector.ok ? `${motor.pgvector.rostosIndexados} rostos` : "Sem indice"}
            ok={Boolean(motor?.pgvector.ok)}
            detail={motor?.pgvector.ultimoIndice ? `Ultimo indice ${fmtDate(motor.pgvector.ultimoIndice)}` : motor?.pgvector.erro}
          />
          <HealthItem
            icon={<HardDrive size={17} />}
            label="Drive"
            value={motor?.drive.ok ? "Conectado" : "Indisponivel"}
            ok={Boolean(motor?.drive.ok)}
            detail={motor?.drive.email ?? motor?.drive.erro}
          />
          <HealthItem
            icon={<Bell size={17} />}
            label="Sininho"
            value={
              motor?.notificacoes.siteUrlConfigurada && motor?.notificacoes.secretConfigurado
                ? "Pronto"
                : "Configurar"
            }
            ok={Boolean(motor?.notificacoes.siteUrlConfigurada && motor?.notificacoes.secretConfigurado)}
            detail={`${motor?.perfis.comRosto ?? 0} pessoa(s) com rosto`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <RefreshCw size={18} className={`mt-0.5 text-[#2E7DD1] ${motor?.autoIndex.rodando ? "animate-spin" : ""}`} />
            <div>
              <h2 className="font-bold text-[#0D2B4E]">Autoindexacao</h2>
              <p className="text-xs text-gray-400">
                Ultimo ciclo automatico do face server por evento.
              </p>
            </div>
          </div>
          <StatusBadge
            ok={Boolean(motor?.autoIndex.supported && motor.autoIndex.enabled)}
            label={motor?.autoIndex.rodando ? "Rodando" : motor?.autoIndex.enabled ? "Ligada" : "Revisar"}
          />
        </div>

        {motor?.autoIndex.supported ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="rounded-lg bg-[#F7FAFD] px-2.5 py-1">
                Intervalo: {motor.autoIndex.intervalMin ?? "?"} min
              </span>
              <span className="rounded-lg bg-[#F7FAFD] px-2.5 py-1">
                Catalogo remoto: {motor.autoIndex.catalogoRemoto ? "galeria" : "local"}
              </span>
              <span className="rounded-lg bg-[#F7FAFD] px-2.5 py-1">
                Ultimo inicio: {fmtDate(motor.autoIndex.ultimoCiclo?.iniciadoEm)}
              </span>
              <span className="rounded-lg bg-[#F7FAFD] px-2.5 py-1">
                Perfis no ciclo: {motor.autoIndex.ultimoCiclo?.perfisProntos ?? 0}
              </span>
            </div>
            {motor.autoIndex.ultimoCiclo?.erro && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {motor.autoIndex.ultimoCiclo.erro}
              </div>
            )}
            {motor.autoIndex.ultimoCiclo?.eventos.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {motor.autoIndex.ultimoCiclo.eventos.map((evento) => (
                  <AutoIndexRow key={`${evento.eventoId}:${evento.status}`} evento={evento} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Clock size={20} />}
                title="Aguardando primeiro ciclo"
                text="Depois que o face server roda a autoindexacao, cada evento aparece aqui."
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={<RefreshCw size={20} />}
            title="Status automatico indisponivel"
            text={motor?.autoIndex.erro ?? "Atualize o face server e recarregue este painel."}
          />
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Play size={18} className="text-[#2E7DD1]" />
            <div>
              <h2 className="font-bold text-[#0D2B4E]">Indexacao do evento</h2>
              <p className="text-xs text-gray-400">Use o motor do servidor e acompanhe o job aqui.</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#0D2B4E]">Evento</span>
              <select
                value={eventoSel}
                onChange={(event) => setEventoSel(event.target.value)}
                className="h-12 w-full rounded-xl border border-gray-200 bg-[#F7FAFD] px-3 text-sm font-semibold text-[#0D2B4E] outline-none transition focus:border-[#2E7DD1]"
              >
                <option value="">Selecionar evento</option>
                {eventos.filter((evento) => evento.folder_id).map((evento) => (
                  <option key={evento.id} value={evento.id}>
                    {evento.nome} ({evento.total_fotos} fotos)
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={iniciar}
              disabled={!eventoAtual?.folder_id || iniciando || jobs[eventoSel]?.status === "running"}
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2167AE] px-4 text-sm font-bold text-white shadow transition hover:bg-[#19558F] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {iniciando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {selecionadoIndexado ? "Reindexar evento" : "Indexar evento"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <IndexStat label="Fotos do evento" value={String(eventoAtual?.total_fotos ?? 0)} icon={<Images size={15} />} />
            <IndexStat label="Fotos com rosto" value={String(preview?.fotosComRosto ?? 0)} icon={<ScanFace size={15} />} />
            <IndexStat label="Rostos salvos" value={String(preview?.rostosDetectados ?? 0)} icon={<Database size={15} />} />
            <IndexStat label="Pessoas achadas" value={String(matches?.usuarios.length ?? 0)} icon={<Users size={15} />} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="rounded-lg bg-gray-50 px-2.5 py-1">
              Indice: {preview ? fmtDate(preview.indexedAt) : "pendente"}
            </span>
            <span className="rounded-lg bg-gray-50 px-2.5 py-1">
              Fonte: {previewSource ?? "sem amostra"}
            </span>
            <span className="rounded-lg bg-gray-50 px-2.5 py-1">
              Matches salvos: {matches ? fmtDate(matches.processadoEm) : "pendente"}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <div>
              <h2 className="font-bold text-[#0D2B4E]">Checklist</h2>
              <p className="text-xs text-gray-400">O que precisa estar verde.</p>
            </div>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex gap-2 rounded-xl bg-[#F7FAFD] px-3 py-2.5">
                {item.ok
                  ? <CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                  : <XCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0D2B4E]">{item.label}</p>
                  <p className="truncate text-[11px] text-gray-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {jobsVisiveis.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-[#2E7DD1]" />
            <h2 className="font-bold text-[#0D2B4E]">Jobs do servidor</h2>
          </div>
          <div className="space-y-3">
            {jobsVisiveis.map((job) => (
              <JobRow key={job.jobId} job={job} onDispensar={() => dispensar(job.eventoId)} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScanFace size={18} className="text-[#2E7DD1]" />
              <div>
                <h2 className="font-bold text-[#0D2B4E]">Rostos salvos no indice</h2>
                <p className="text-xs text-gray-400">Amostra do que o motor vai comparar.</p>
              </div>
            </div>
            <button
              onClick={() => carregarEvento(eventoSel)}
              disabled={!eventoSel || carregandoEvento}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-[#2E7DD1] transition hover:bg-[#EFF5FF] disabled:opacity-40"
              title="Atualizar amostra"
            >
              {carregandoEvento ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>
          {preview?.fotos.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {preview.fotos.slice(0, 8).map((foto) => (
                <div key={foto.fotoId} className="overflow-hidden rounded-xl border border-gray-100 bg-[#F7FAFD]">
                  <Image
                    src={`/api/thumb?id=${encodeURIComponent(foto.fotoId)}&sz=320`}
                    alt=""
                    width={320}
                    height={240}
                    unoptimized
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="flex gap-2 overflow-x-auto p-2">
                    {foto.rostos.map((rosto) => (
                      <Image
                        key={rosto.id}
                        src={rosto.cropUrl}
                        alt=""
                        width={56}
                        height={56}
                        unoptimized
                        title={rosto.score === null ? "Rosto detectado" : `Score ${rosto.score.toFixed(2)}`}
                        className="h-14 w-14 shrink-0 rounded-lg border border-white object-cover shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Database size={20} />}
              title="Sem rostos no indice deste evento"
              text="Rode a indexacao do evento e atualize a amostra."
            />
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserRoundCheck size={18} className="text-emerald-600" />
            <div>
              <h2 className="font-bold text-[#0D2B4E]">Matches encontrados</h2>
              <p className="text-xs text-gray-400">Pessoas que vao receber o sininho do evento.</p>
            </div>
          </div>
          {matches?.usuarios.length ? (
            <div className="space-y-2.5">
              {matches.usuarios.map((usuario) => (
                <div key={usuario.email} className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0D2B4E]">{usuario.nome || usuario.email}</p>
                    <p className="truncate text-xs text-gray-400">
                      {usuario.email} | {usuario.fotosIds.length} foto(s)
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {usuario.fotosIds.slice(0, 4).map((id) => (
                      <Image
                        key={id}
                        src={`/api/thumb?id=${encodeURIComponent(id)}&sz=120`}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={20} />}
              title="Nenhum match salvo"
              text="Apos indexar, os perfis reconhecidos aparecem aqui."
            />
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[#2E7DD1]" />
            <div>
              <h2 className="font-bold text-[#0D2B4E]">Historico recente</h2>
              <p className="text-xs text-gray-400">Resultados salvos pelo motor por evento.</p>
            </div>
          </div>
          <Link href="/admin/reconhecimento" className="text-xs font-semibold text-[#2E7DD1] hover:underline">
            Abrir ferramenta legada
          </Link>
        </div>
        {historico.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {historico.map((item) => (
              <button
                key={`${item.eventoId}:${item.processadoEm}`}
                onClick={() => setEventoSel(item.eventoId)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  item.eventoId === eventoSel
                    ? "border-[#2E7DD1]/35 bg-[#EFF5FF]"
                    : "border-gray-100 hover:border-[#2E7DD1]/25 hover:bg-[#F7FAFD]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0D2B4E]">{item.eventoNome}</p>
                  <p className="text-xs text-gray-400">{fmtDate(item.processadoEm)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-[#2167AE]">{item.usuarios.length}</p>
                  <p className="text-[10px] text-gray-400">matches</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock size={20} />}
            title="Sem historico ainda"
            text="Os eventos indexados com matches salvos aparecem aqui."
          />
        )}
      </section>
    </div>
  );
}

function AutoIndexRow({ evento }: { evento: AutoIndexEvento }) {
  const erro = evento.status === "erro";
  const ativo = evento.status === "indexando";
  const pronto = evento.status === "ok" || evento.status === "indexado";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${
      erro ? "border-red-200 bg-red-50/60" : ativo ? "border-[#2E7DD1]/25 bg-[#EFF5FF]" : "border-gray-100 bg-[#F7FAFD]"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#0D2B4E]">{evento.nome}</p>
          <p className={`mt-0.5 text-xs ${erro ? "font-semibold text-red-600" : "text-gray-500"}`}>
            {evento.motivo}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          erro
            ? "bg-red-100 text-red-700"
            : pronto
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }`}>
          {erro ? <AlertCircle size={11} /> : pronto ? <CheckCircle size={11} /> : <RefreshCw size={11} />}
          {evento.status}
        </span>
      </div>
      {(evento.matches !== undefined || evento.fotosComRosto !== undefined) && (
        <p className="mt-1 text-[11px] text-gray-400">
          {evento.matches ?? 0} match(es) | {evento.fotosComRosto ?? 0} foto(s) com rosto
        </p>
      )}
    </div>
  );
}

function HealthItem({
  icon,
  label,
  value,
  detail,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string | null;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-[#F7FAFD] px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={ok ? "text-emerald-600" : "text-amber-500"}>{icon}</span>
        <StatusBadge ok={ok} label={ok ? "OK" : "Revisar"} />
      </div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="truncate text-lg font-black text-[#0D2B4E]">{value}</p>
      <p className="truncate text-[11px] text-gray-400">{detail ?? "Aguardando leitura"}</p>
    </div>
  );
}

function IndexStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#F7FAFD] px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[#2E7DD1]">
        {icon}
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      <p className="text-2xl font-black text-[#0D2B4E]">{value}</p>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
      ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
    }`}>
      {label}
    </span>
  );
}

function JobRow({ job, onDispensar }: { job: JobStatus; onDispensar: () => void }) {
  const pct = job.fotosTotal ? Math.round((job.fotosProcessadas / job.fotosTotal) * 100) : 0;
  const done = job.status === "done";
  const error = job.status === "error";
  return (
    <div className={`rounded-xl border px-4 py-3 ${
      done ? "border-emerald-200" : error ? "border-red-200" : "border-[#2E7DD1]/25"
    }`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#0D2B4E]">{job.eventoNome}</p>
          <p className="text-xs text-gray-400">
            {FASE_LABEL[job.fase] ?? job.fase} | iniciado {fmtDate(job.iniciadoEm)}
          </p>
        </div>
        <button
          onClick={onDispensar}
          title="Remover desta lista"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full transition-all ${done ? "bg-emerald-500" : error ? "bg-red-500" : "bg-[#2E7DD1]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-5">
        <JobStat label="Fotos" value={`${job.fotosProcessadas}/${job.fotosTotal}`} />
        <JobStat label="Com rosto" value={String(job.fotosComRosto)} />
        <JobStat label="Rostos" value={String(job.rostosDetectados)} />
        <JobStat label="Matches" value={String(job.matches)} />
        <JobStat label="Sininho" value={String(job.notificacoes ?? 0)} />
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{job.erro}</p>}
    </div>
  );
}

function JobStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F7FAFD] px-2 py-1.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="font-bold text-[#0D2B4E]">{value}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl bg-[#F7FAFD] px-4 text-center">
      <div className="mb-2 text-[#2E7DD1]">{icon}</div>
      <p className="text-sm font-bold text-[#0D2B4E]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-gray-400">{text}</p>
    </div>
  );
}
