"use client";
import { useEffect, useState, useCallback } from "react";
import { Play, Server, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, X } from "lucide-react";

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
  erro: string | null;
}

const STORAGE_KEY = "indexar_remoto_jobs_v1";

interface JobsStore {
  [eventoId: string]: string; // eventoId -> jobId
}

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

const FASE_LABEL: Record<string, string> = {
  iniciando: "Iniciando",
  listando_fotos: "Listando fotos do Drive",
  recuperando_progresso: "Verificando progresso anterior",
  detectando_rostos: "Detectando rostos",
  fazendo_matches: "Procurando usuários nas fotos",
  salvando_matches: "Salvando resultados",
  clusterizando: "Agrupando pessoas",
  concluido: "Concluído",
};

export default function ReconhecimentoServidor() {
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [eventoSel, setEventoSel] = useState<string>("");
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [jobs, setJobs] = useState<Record<string, JobStatus>>({});
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega lista de eventos
  useEffect(() => {
    fetch("/api/eventos")
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : data.eventos || [];
        setEventos(lista);
        setCarregandoEventos(false);
      })
      .catch((e) => {
        setErro(`Falha ao carregar eventos: ${e.message}`);
        setCarregandoEventos(false);
      });
  }, []);

  const fetchStatus = useCallback(async (eventoId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/indexar-remoto/status?jobId=${encodeURIComponent(jobId)}`);
      if (res.status === 404) {
        // Job sumiu (servidor reiniciou). Limpa local.
        removerJobLocal(eventoId);
        setJobs((j) => {
          const novo = { ...j };
          delete novo[eventoId];
          return novo;
        });
        return;
      }
      if (!res.ok) return;
      const status: JobStatus = await res.json();
      setJobs((j) => ({ ...j, [eventoId]: status }));
      if (status.status === "done" || status.status === "error") {
        // Mantém visivel mas para de poll
      }
    } catch (err) {
      console.warn("poll falhou", err);
    }
  }, []);

  // Polling: a cada 10s busca status dos jobs salvos no localStorage
  useEffect(() => {
    const tick = async () => {
      const armazenados = lerJobsLocal();
      const promises = Object.entries(armazenados).map(([ev, jb]) => fetchStatus(ev, jb));
      await Promise.all(promises);
    };
    tick(); // primeira chamada imediata
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function iniciar() {
    if (!eventoSel) return;
    const evento = eventos.find((e) => e.id === eventoSel);
    if (!evento?.folder_id) {
      setErro("Evento sem folder_id no Drive");
      return;
    }
    setIniciando(true);
    setErro(null);
    try {
      const res = await fetch("/api/indexar-remoto/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: evento.id,
          eventoNome: evento.nome,
          folderId: evento.folder_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      salvarJobLocal(evento.id, data.jobId);
      // Carrega status imediato
      await fetchStatus(evento.id, data.jobId);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setIniciando(false);
    }
  }

  function dispensar(eventoId: string) {
    removerJobLocal(eventoId);
    setJobs((j) => {
      const novo = { ...j };
      delete novo[eventoId];
      return novo;
    });
  }

  const jobsAtivos = Object.values(jobs);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center gap-3 pb-4 border-b">
        <Server className="w-8 h-8 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold">Indexação no servidor (background)</h1>
          <p className="text-sm text-gray-600">
            Processa fotos sem precisar manter aba aberta. Roda no Render Free Tier.
          </p>
        </div>
      </header>

      {/* Iniciar */}
      <section className="bg-white rounded-xl shadow border p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Play className="w-5 h-5 text-purple-600" /> Iniciar nova indexação
        </h2>
        {carregandoEventos ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando eventos...
          </div>
        ) : (
          <>
            <select
              value={eventoSel}
              onChange={(e) => setEventoSel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">— Escolha um evento —</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome} ({ev.total_fotos} fotos)
                </option>
              ))}
            </select>
            <button
              onClick={iniciar}
              disabled={!eventoSel || iniciando || !!jobs[eventoSel]?.status?.includes("running")}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              {iniciando ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando...</>
              ) : (
                <><Play className="w-5 h-5" /> Iniciar indexação em background</>
              )}
            </button>
            <p className="text-xs text-gray-500 leading-relaxed">
              Depois de iniciar você pode <strong>fechar a aba ou desligar o PC</strong>. O servidor
              Render processa as fotos sozinho (estimado: 30-60 min pra 500 fotos no plano free).
              Quando voltar nesta página, o progresso aparece automaticamente.
            </p>
          </>
        )}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {erro}
          </div>
        )}
      </section>

      {/* Jobs ativos */}
      {jobsAtivos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" /> Jobs em andamento ({jobsAtivos.length})
          </h2>
          {jobsAtivos.map((job) => {
            const pct = job.fotosTotal
              ? Math.round((job.fotosProcessadas / job.fotosTotal) * 100)
              : 0;
            const isDone = job.status === "done";
            const isError = job.status === "error";
            return (
              <div
                key={job.jobId}
                className={`bg-white rounded-xl shadow border p-5 space-y-3 ${
                  isDone ? "border-green-300" : isError ? "border-red-300" : "border-blue-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{job.eventoNome}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Iniciado{" "}
                      {new Date(job.iniciadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>
                  <button
                    onClick={() => dispensar(job.eventoId)}
                    title="Remover da lista (não cancela o job)"
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {isDone ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isError ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  <span className="font-medium">
                    {FASE_LABEL[job.fase] || job.fase}
                    {isError && ` — ${job.erro}`}
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isDone ? "bg-green-500" : isError ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Stat label="Processadas" value={`${job.fotosProcessadas}/${job.fotosTotal}`} />
                  <Stat label="Com rosto" value={String(job.fotosComRosto)} />
                  <Stat label="Rostos" value={String(job.rostosDetectados)} />
                  <Stat label="Matches" value={String(job.matches)} />
                </div>

                {isDone && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                    ✅ Indexação concluída. {job.matches} usuário(s) reconhecido(s).
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {jobsAtivos.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          Nenhum job em andamento. Escolha um evento acima pra começar.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}
