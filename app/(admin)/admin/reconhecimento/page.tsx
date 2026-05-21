"use client";
import { useEffect, useState } from "react";
import {
  ScanFace, Play, CheckCircle, Users, Loader2,
  AlertCircle, Camera, Bell, RefreshCw, Database, Zap, Images,
  Sparkles, Layers, Clock, Send,
} from "lucide-react";
import type { ReindexFlag } from "@/app/api/indexacao/flags/route";
import { fetchDescritores, invalidarDescritoresCache } from "@/lib/descritoresCache";
import { clusterizar, type FaceDetection } from "@/lib/clustering";

// Tipos locais (evita importar de rotas de API)
interface EventoItem {
  id: string; nome: string; data: string; folder_id?: string; total_fotos: number; status: string;
}
interface FotoDescritores {
  fotoId: string; rostos: { descriptor: number[] }[];
}
interface ResultadoSalvo {
  processadoEm: string; totalFotos: number; fotosComRosto: number;
  usuarios: { email: string; nome: string; fotosIds: string[]; thumbUrl?: string }[];
}

interface PerfilComDesc {
  email: string;
  nome: string;
  descriptor: number[];        // legado — primeira selfie
  descriptors?: number[][];    // múltiplas selfies (preferido)
  notificar_site: boolean;
  thumb: string | null;
}

interface MatchUsuario {
  email: string;
  nome: string;
  fotosIds: string[];
  thumbUrl?: string;
  notificado: boolean;
}

type Fase =
  | "idle"
  | "carregando_perfis"
  | "carregando_fotos"
  | "carregando_modelos"
  | "processando"
  | "salvando_index"
  | "notificando"
  | "done"
  | "erro";

const FASES_OCUPADAS: Fase[] = [
  "carregando_perfis","carregando_fotos","carregando_modelos",
  "processando","salvando_index","notificando",
];

export default function ReconhecimentoPage() {
  const [eventos,      setEventos]      = useState<EventoItem[]>([]);
  const [eventoId,     setEventoId]     = useState("");
  const [fase,         setFase]         = useState<Fase>("idle");
  const [progresso,    setProgresso]    = useState(0);
  const [total,        setTotal]        = useState(0);
  const [matches,      setMatches]      = useState<MatchUsuario[]>([]);
  const [notifSent,    setNotifSent]    = useState(0);
  const [notifEmailOk,  setNotifEmailOk]  = useState(0);
  const [notifSiteOk,   setNotifSiteOk]   = useState(0);
  const [emailTentado,  setEmailTentado]  = useState(false);
  const [notifFalhas,   setNotifFalhas]   = useState<{ email: string; canal: string; status?: number; erro?: string }[]>([]);
  const [fotosIndex,   setFotosIndex]   = useState(0);
  const [erro,         setErro]         = useState("");
  const [ultimoEvento, setUltimoEvento] = useState("");
  const [perfisCarregados, setPerfisCarregados] = useState(0);
  const [resultadoSalvo, setResultadoSalvo] = useState<ResultadoSalvo | null>(null);
  const [totalPerfis, setTotalPerfis] = useState<number | null>(null);

  // Status de indexação por evento
  const [statusIndex, setStatusIndex] = useState<Record<string, boolean>>({});

  // Flags de reindexação automática
  const [reindexFlags, setReindexFlags] = useState<ReindexFlag[]>([]);
  const [autoProcessando, setAutoProcessando] = useState(false);

  // Indexar todos
  const [indexandoTodos, setIndexandoTodos] = useState(false);
  const [filaIdx,        setFilaIdx]        = useState(0);
  const [filaTotal,      setFilaTotal]      = useState(0);

  // Histórico de indexações
  interface HistoricoItem extends ResultadoSalvo {
    eventoId: string; eventoNome: string;
  }
  const [historico,       setHistorico]       = useState<HistoricoItem[]>([]);
  const [notifHistorico,  setNotifHistorico]  = useState<Record<string, "idle"|"enviando"|"ok">>({});

  // Status do token Drive (pra não enviar notificações em vão)
  const [driveStatus, setDriveStatus] = useState<{ ok: boolean; motivo?: string; email?: string } | null>(null);

  // Diagnóstico de notificações
  const [diagEmail,   setDiagEmail]   = useState("");
  const [diagNotifs,  setDiagNotifs]  = useState<{ id: string; titulo: string; mensagem: string; criada_em: string; lida: boolean }[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagErro,    setDiagErro]    = useState("");
  const [diagTeste,   setDiagTeste]   = useState<{ status: number; body: string } | null>(null);

  async function diagConsultar() {
    if (!diagEmail.trim()) return;
    setDiagLoading(true); setDiagErro(""); setDiagNotifs(null);
    try {
      const r = await fetch(`/api/notificacoes?email=${encodeURIComponent(diagEmail.trim())}`);
      if (!r.ok) {
        setDiagErro(`HTTP ${r.status} — ${await r.text().catch(() => "")}`);
      } else {
        setDiagNotifs(await r.json());
      }
    } catch (e) { setDiagErro(String(e)); }
    setDiagLoading(false);
  }

  async function diagEnviarTeste() {
    if (!diagEmail.trim()) return;
    setDiagTeste(null);
    const r = await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: diagEmail.trim(),
        tipo: "fotos_encontradas",
        titulo: "🧪 Teste de notificação",
        mensagem: "Se você está vendo isso, o sininho está funcionando.",
        link: "/perfil",
      }),
    });
    const body = await r.text();
    setDiagTeste({ status: r.status, body: body.slice(0, 200) });
  }

  // Auto-iniciar indexação quando há eventos não indexados
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [autoCancelado, setAutoCancelado] = useState(false);

  // Marcador de indexação interrompida (pra retomar ao reabrir)
  interface Marcador { filaIdsPendentes: string[]; iniciadoEm: string }
  const MARCADOR_KEY = "recon_em_andamento";
  const [interrompida, setInterrompida] = useState<Marcador | null>(null);

  function gravarMarcador(filaIds: string[]) {
    if (filaIds.length === 0) {
      try { localStorage.removeItem(MARCADOR_KEY); } catch {}
      return;
    }
    try {
      const m: Marcador = { filaIdsPendentes: filaIds, iniciadoEm: new Date().toISOString() };
      localStorage.setItem(MARCADOR_KEY, JSON.stringify(m));
    } catch {}
  }
  function limparMarcador() {
    try { localStorage.removeItem(MARCADOR_KEY); } catch {}
  }

  // Restaura evento selecionado após F5
  useEffect(() => {
    try {
      const saved = localStorage.getItem("recon_eventoId");
      if (saved) setEventoId(saved);
    } catch {}
    // Detecta indexação interrompida
    try {
      const raw = localStorage.getItem(MARCADOR_KEY);
      if (raw) {
        const m: Marcador = JSON.parse(raw);
        if (Array.isArray(m.filaIdsPendentes) && m.filaIdsPendentes.length > 0) {
          setInterrompida(m);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (eventoId) localStorage.setItem("recon_eventoId", eventoId);
    } catch {}
  }, [eventoId]);

  useEffect(() => {
    // Carrega eventos e verifica indexação + histórico
    fetch("/api/eventos")
      .then((r) => r.json())
      .then(async (data: EventoItem[]) => {
        if (!Array.isArray(data)) return;
        setEventos(data);
        const candidatos = data.filter(e => e.folder_id);
        const statusMap: Record<string, boolean> = {};
        await Promise.all(candidatos.map(async (ev) => {
          const json = await fetchDescritores(ev.id);
          if (!json?.indexado) return;
          statusMap[ev.id] = true;
          const mr = await fetch(`/api/matches?eventoId=${ev.id}`).catch(() => null);
          if (!mr?.ok) return;
          const md = await mr.json();
          if (md?.processadoEm) {
            setHistorico(prev => {
              if (prev.some(h => h.eventoId === ev.id)) return prev;
              return [...prev, { ...md, eventoId: ev.id, eventoNome: ev.nome }]
                .sort((a, b) => new Date(b.processadoEm).getTime() - new Date(a.processadoEm).getTime());
            });
          }
        }));
        setStatusIndex(statusMap);
        // Após todo o status conhecido, dispara countdown se houver pendentes
        const pendentes = candidatos.filter(e => e.total_fotos > 0 && !statusMap[e.id]);
        if (pendentes.length > 0) setAutoCountdown(5);
      });

    // Carrega contagem de perfis com rosto cadastrado
    fetch("/api/perfil/todos")
      .then(r => r.ok ? r.json() : [])
      .then(data => setTotalPerfis(Array.isArray(data) ? data.length : 0))
      .catch(() => setTotalPerfis(0));

    // Carrega flags de reindexação
    fetch("/api/indexacao/flags")
      .then(r => r.ok ? r.json() : [])
      .then((flags: ReindexFlag[]) => setReindexFlags(flags))
      .catch(() => {});

    // Verifica saúde do token Drive
    fetch("/api/admin/drive-status")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDriveStatus(d); })
      .catch(() => {});
  }, []);

  // Countdown do auto-start (definido depois de indexarTodos via lookup via ref-like)

  // Quando seleciona evento, carrega resultado salvo anteriormente
  useEffect(() => {
    if (!eventoId) { setResultadoSalvo(null); return; }
    setResultadoSalvo(null);
    fetch(`/api/matches?eventoId=${eventoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setResultadoSalvo(data); })
      .catch(() => {});
  }, [eventoId]);

  const evento  = eventos.find((e) => e.id === eventoId);
  const ocupado = FASES_OCUPADAS.includes(fase);

  // Auto-processa flags em sequência quando o painel está aberto e livre
  async function processarFlagsAuto() {
    if (autoProcessando || ocupado) return;
    setAutoProcessando(true);
    for (const flag of reindexFlags) {
      const ev = eventos.find(e => e.id === flag.eventoId);
      if (!ev) continue;
      setEventoId(ev.id);
      await iniciar(ev, true);
    }
    setAutoProcessando(false);
  }
  async function indexarTodos(filaOverride?: EventoItem[], incremental = false) {
    const fila = filaOverride ?? eventos.filter(e => e.folder_id && e.total_fotos > 0);
    if (!fila.length || ocupado || indexandoTodos) return;
    setIndexandoTodos(true);
    setFilaTotal(fila.length);
    // Marca fila pendente — se aba fechar, próxima abertura oferece retomar
    gravarMarcador(fila.map(e => e.id));
    for (let i = 0; i < fila.length; i++) {
      setFilaIdx(i + 1);
      setEventoId(fila[i].id);
      await iniciar(fila[i], incremental);
      // Atualiza marcador removendo o que acabou de ser processado
      gravarMarcador(fila.slice(i + 1).map(e => e.id));
      await new Promise(r => setTimeout(r, 400));
    }
    setIndexandoTodos(false);
    setFase("done");
    limparMarcador();
    setInterrompida(null);
  }

  // Retoma indexação interrompida (modo incremental — pula fotos já no índice)
  async function retomarIndexacao() {
    if (!interrompida) return;
    const fila = interrompida.filaIdsPendentes
      .map(id => eventos.find(e => e.id === id))
      .filter((e): e is EventoItem => !!e?.folder_id);
    if (!fila.length) { limparMarcador(); setInterrompida(null); return; }
    setInterrompida(null);
    await indexarTodos(fila, /* incremental */ true);
  }
  function descartarRetomada() {
    limparMarcador();
    setInterrompida(null);
  }

  // Countdown do auto-start (declarado aqui pra ter acesso a ocupado / indexarTodos)
  useEffect(() => {
    if (autoCountdown === null || autoCancelado) return;
    if (autoCountdown <= 0) {
      if (driveStatus?.ok !== false && !ocupado && !indexandoTodos) {
        indexarTodos();
      }
      setAutoCountdown(null);
      return;
    }
    const t = setTimeout(() => setAutoCountdown(c => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCountdown, autoCancelado, driveStatus, ocupado, indexandoTodos]);

  // Bloqueia saída acidental enquanto indexação está rodando
  useEffect(() => {
    const ativo = ocupado || indexandoTodos;
    if (!ativo) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "Indexação em andamento — fechar agora vai pausar o processo. O progresso salvo até aqui pode ser retomado depois.";
      return e.returnValue;
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [ocupado, indexandoTodos]);

  async function notificarEvento(item: HistoricoItem) {
    if (!item.usuarios.length) return;
    setNotifHistorico(prev => ({ ...prev, [item.eventoId]: "enviando" }));
    for (const u of item.usuarios) {
      await fetch("/api/reconhecimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: u.email, nomeEvento: item.eventoNome,
          eventoSlug: item.eventoId,
          thumbUrl: u.thumbUrl ? `${window.location.origin}${u.thumbUrl}` : undefined,
        }),
      }).catch(() => {});
    }
    setNotifHistorico(prev => ({ ...prev, [item.eventoId]: "ok" }));
    setTimeout(() => setNotifHistorico(prev => ({ ...prev, [item.eventoId]: "idle" })), 3000);
  }

  function tempoRelativo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(diff / 3600000);
    const d    = Math.floor(diff / 86400000);
    if (min < 2)  return "agora mesmo";
    if (min < 60) return `há ${min} min`;
    if (h < 24)   return `há ${h}h`;
    if (d < 7)    return `há ${d} dia${d !== 1 ? "s" : ""}`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  const pct     = total > 0 ? Math.round((progresso / total) * 100) : 0;

  async function iniciar(ev = evento, incremental = false) {
    if (!ev?.folder_id) return;
    setFase("carregando_perfis");
    setProgresso(0);
    setTotal(0);
    setMatches([]);
    setNotifSent(0);
    setNotifEmailOk(0);
    setNotifSiteOk(0);
    setEmailTentado(false);
    setNotifFalhas([]);
    setFotosIndex(0);
    setErro("");
    setUltimoEvento(ev.nome);
    setPerfisCarregados(0);

    try {
      // ── 1. Perfis cadastrados com descriptor ──────────────────────
      const perfisRes = await fetch("/api/perfil/todos");
      if (!perfisRes.ok) throw new Error("Falha ao carregar perfis");
      const perfisJson = await perfisRes.json();
      const perfis: PerfilComDesc[] = Array.isArray(perfisJson) ? perfisJson : [];
      const perfisValidos = perfis.filter((p) =>
        (Array.isArray(p.descriptor) && p.descriptor.length === 128) ||
        (Array.isArray(p.descriptors) && p.descriptors.length > 0 && p.descriptors.every(d => Array.isArray(d) && d.length === 128))
      );
      setPerfisCarregados(perfisValidos.length);

      // ── 2. Fotos do evento ────────────────────────────────────────
      setFase("carregando_fotos");
      const fotosRes = await fetch(`/api/fotos?folderId=${ev.folder_id}`);
      const { fotos } = await fotosRes.json();
      let lista: { id: string; name: string }[] = fotos ?? [];
      if (!lista.length) { setFase("done"); return; }

      // ── Modo incremental: pula fotos já no índice ─────────────────
      let indexExistente: FotoDescritores[] = [];
      if (incremental) {
        // Cache invalidado abaixo antes do POST, então aqui sempre pega fresh
        invalidarDescritoresCache(ev.id);
        const idxJson = await fetchDescritores(ev.id);
        if (idxJson?.indexado && Array.isArray(idxJson.dados)) {
          indexExistente = idxJson.dados;
          const jaIndexados = new Set(indexExistente.map((f: FotoDescritores) => f.fotoId));
          lista = lista.filter(f => !jaIndexados.has(f.id));
        }
      }
      if (!lista.length) { setFase("done"); return; }
      setTotal(lista.length);

      // ── 3. Carregar modelos face-api (SsdMobilenetv1 — detector pesado e preciso) ──
      setFase("carregando_modelos");
      const { loadFaceModels, detectorOptions } = await import("@/lib/faceapi-loader");
      const faceapi = await loadFaceModels();

      // 0.55 captura "mesma pessoa em ângulo/maquiagem/expressão diferente".
      // < 0.45 era ultra-restrito e perdia muitos matches reais.
      const THRESHOLD = 0.55;
      // Pra cada perfil, usa TODAS as selfies cadastradas (não só a primeira).
      // Mais selfies = mais ângulos/iluminações cobertos = melhor recall.
      const matcher = perfisValidos.length > 0
        ? new faceapi.FaceMatcher(
            perfisValidos.map(p => {
              const todos = (p.descriptors && p.descriptors.length > 0 ? p.descriptors : [p.descriptor])
                .filter(d => Array.isArray(d) && d.length === 128)
                .map(d => new Float32Array(d));
              return new faceapi.LabeledFaceDescriptors(p.email, todos);
            }),
            THRESHOLD
          )
        : null;

      // ── 4. Processar fotos em lotes ───────────────────────────────
      setFase("processando");
      const indexFotos: FotoDescritores[] = [];
      const matchMap = new Map<string, { nome: string; fotosIds: Set<string>; thumbUrl?: string }>();

      const LOTE = 4;
      const SAVE_A_CADA_LOTES = 8;   // salva no Drive a cada 8 lotes (~32 fotos)
      let loteCount = 0;
      for (let i = 0; i < lista.length; i += LOTE) {
        const lote = lista.slice(i, i + LOTE);
        await Promise.all(lote.map(async (foto) => {
          try {
            // sz=800 → resolução boa pra SSD detectar rostos pequenos
            const img = await faceapi.fetchImage(`/api/thumb?id=${foto.id}&sz=800`);
            const detections = await faceapi
              .detectAllFaces(img, detectorOptions(faceapi, 0.5))
              .withFaceLandmarks(/* useTinyModel */ false)
              .withFaceDescriptors();
            if (!detections.length) return;
            // Filtra rostos muito pequenos (< 40px) — descritor seria ruim
            const validos = detections.filter(d => {
              const box = d.detection.box;
              return Math.min(box.width, box.height) >= 40;
            });
            if (!validos.length) return;
            indexFotos.push({ fotoId: foto.id, rostos: validos.map(d => ({ descriptor: Array.from(d.descriptor) })) });
            setFotosIndex(prev => prev + 1);
            if (matcher) {
              for (const det of validos) {
                const best = matcher.findBestMatch(det.descriptor);
                if (best.label === "unknown") continue;
                const perfil = perfisValidos.find(p => p.email === best.label);
                if (!matchMap.has(best.label)) {
                  matchMap.set(best.label, { nome: perfil?.nome ?? best.label, fotosIds: new Set([foto.id]), thumbUrl: `/api/thumb?id=${foto.id}&sz=120` });
                } else {
                  matchMap.get(best.label)!.fotosIds.add(foto.id);
                }
              }
            }
          } catch { /**/ }
        }));
        setProgresso(Math.min(i + LOTE, lista.length));

        // Salva parcial a cada N lotes — se a aba for fechada, retoma de onde parou
        loteCount++;
        if (loteCount % SAVE_A_CADA_LOTES === 0 && indexFotos.length > 0) {
          const parcial = [...indexExistente, ...indexFotos];
          fetch("/api/descritores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventoId: ev.id, dados: parcial }),
          })
            .then(() => invalidarDescritoresCache(ev.id))
            .catch(() => { /* falhou save parcial — re-tenta no próximo lote */ });
        }
      }

      // ── 5. Salva índice (merge com existente no modo incremental) ─
      setFase("salvando_index");
      const indexFinal = incremental
        ? [...indexExistente, ...indexFotos]  // merge: existente + novas fotos
        : indexFotos;

      const processadoEm = new Date().toISOString();
      const usuariosMatch = Array.from(matchMap.entries()).map(([email, d]) => ({
        email, nome: d.nome, fotosIds: Array.from(d.fotosIds), thumbUrl: d.thumbUrl,
      }));

      // ─── Clustering: agrupa rostos parecidos em "pessoas únicas" ───
      // Roda em todos os rostos detectados. Resultado: lista pequena de "pessoas"
      // que torna o match de usuário 10x+ mais rápido.
      const deteccoesFlat: FaceDetection[] = [];
      for (const f of indexFinal) {
        for (const r of f.rostos) {
          deteccoesFlat.push({ fotoId: f.fotoId, descriptor: r.descriptor });
        }
      }
      const CLUSTER_THRESHOLD = 0.50;
      const clusters = clusterizar(deteccoesFlat, CLUSTER_THRESHOLD);

      // Invalida cache local — novos dados vão ser baixados na próxima leitura
      invalidarDescritoresCache(ev.id);
      await Promise.all([
        fetch("/api/descritores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventoId: ev.id, dados: indexFinal }),
        }),
        fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventoId: ev.id, eventoNome: ev.nome,
            processadoEm,
            totalFotos: indexFinal.length,
            fotosComRosto: indexFinal.length,
            usuarios: usuariosMatch,
          }),
        }),
        // Salva clusters de pessoas detectadas — usado pelo /cadastrar-rosto e /resultado
        // pra busca ultra-rápida (compara contra N pessoas em vez de M rostos soltos)
        fetch("/api/pessoas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventoId:   ev.id,
            eventoNome: ev.nome,
            clusters,
            threshold:  CLUSTER_THRESHOLD,
          }),
        }),
        // NOTA: _mf_{email}.json NÃO é gravado aqui automaticamente.
        // A IA do admin gera candidatos (vão pra /resultado), mas o "Minhas fotos"
        // (página agregada) só é populado quando o usuário clica "São minhas" em
        // /resultado pra confirmar — evita poluir com falsos positivos (rosto parecido,
        // amigos etc.). Os matches do admin ficam disponíveis via /api/matches.
      ]);
      setStatusIndex(prev => ({ ...prev, [ev.id]: true }));
      // Atualiza histórico com o resultado recém-salvo
      setHistorico(prev => {
        const novo: HistoricoItem = {
          eventoId: ev.id, eventoNome: ev.nome,
          processadoEm, totalFotos: indexFinal.length,
          fotosComRosto: indexFinal.length, usuarios: usuariosMatch,
        };
        return [novo, ...prev.filter(h => h.eventoId !== ev.id)]
          .sort((a, b) => new Date(b.processadoEm).getTime() - new Date(a.processadoEm).getTime());
      });
      // Limpa flag se era reindexação automática
      if (incremental) {
        fetch(`/api/indexacao/flags?eventoId=${ev.id}`, { method: "DELETE" }).catch(() => {});
        setReindexFlags(prev => prev.filter(f => f.eventoId !== ev.id));
      }

      // ── 6. Envia notificações ─────────────────────────────────────
      const matchArray: MatchUsuario[] = Array.from(matchMap.entries()).map(([email, data]) => ({
        email, nome: data.nome, fotosIds: Array.from(data.fotosIds), thumbUrl: data.thumbUrl, notificado: false,
      }));
      setMatches(matchArray);

      if (matchArray.length > 0) {
        setFase("notificando");
        let count = 0, emailOk = 0, siteOk = 0;
        const falhas: { email: string; canal: string; status?: number; erro?: string }[] = [];
        for (const m of matchArray) {
          try {
            const res = await fetch("/api/reconhecimento", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: m.email, nomeEvento: ev.nome, eventoSlug: ev.id, thumbUrl: m.thumbUrl ? `${window.location.origin}${m.thumbUrl}` : undefined }),
            });
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              falhas.push({ email: m.email, canal: "ambos", status: res.status, erro: txt || res.statusText });
              continue;
            }
            const data = await res.json().catch(() => null);
            // resposta: { ok: true, resultado: ResultadoNotif[] }
            const reais = Array.isArray(data?.resultado) ? data.resultado as { canal: string; ok: boolean; status?: number; erro?: string }[] : [];
            const emailEntry = reais.find(r => r.canal === "email");
            const okEmail = emailEntry?.ok ?? false;
            const okSite  = reais.find(r => r.canal === "site")?.ok  ?? false;
            if (emailEntry) setEmailTentado(true);
            if (okEmail) emailOk++;
            if (okSite)  siteOk++;
            for (const r of reais) {
              if (!r.ok) falhas.push({ email: m.email, canal: r.canal, status: r.status, erro: r.erro });
            }
            if (okEmail || okSite) {
              count++;
              setNotifSent(count);
              setNotifEmailOk(emailOk);
              setNotifSiteOk(siteOk);
              setMatches(prev => prev.map(u => u.email === m.email ? { ...u, notificado: true } : u));
            }
          } catch (e) {
            falhas.push({ email: m.email, canal: "rede", erro: String(e) });
          }
        }
        setNotifFalhas(falhas);
      }

      setFase("done");
    } catch (e) {
      setErro(String(e));
      setFase("erro");
    }
  }

  const faseLabel: Record<Fase, string> = {
    idle:               "",
    carregando_perfis:  "Carregando perfis cadastrados...",
    carregando_fotos:   "Buscando fotos do evento...",
    carregando_modelos: "Carregando modelos de IA...",
    processando:        "Detectando e indexando rostos...",
    salvando_index:     "Salvando índice no Drive...",
    notificando:        "Enviando notificações...",
    done:               "",
    erro:               "",
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
          <ScanFace className="text-[#2E7DD1]" size={26} /> Reconhecimento Facial
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Processa as fotos, cria um índice para buscas instantâneas e notifica os usuários cadastrados.
        </p>
      </div>

      {/* Banner crítico: token Drive sem acesso */}
      {driveStatus && !driveStatus.ok && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-700 text-sm">⚠ Notificações não vão funcionar</p>
            <p className="text-red-600 text-xs mt-1">{driveStatus.motivo}</p>
            <a href="/api/auth/signin?callbackUrl=/admin/reconhecimento"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition">
              Relogar via Google admin
            </a>
          </div>
        </div>
      )}
      {driveStatus?.ok && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mb-3 flex items-center gap-2 text-[11px] text-emerald-700">
          <CheckCircle size={11} /> Drive conectado como <strong>{driveStatus.email}</strong>
        </div>
      )}

      {/* Banner: retomar indexação interrompida (prioridade sobre auto-iniciar) */}
      {interrompida && !ocupado && !indexandoTodos && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-4 mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <RefreshCw size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">
                Indexação interrompida
              </p>
              <p className="text-amber-700 text-xs mt-1">
                {interrompida.filaIdsPendentes.length} evento{interrompida.filaIdsPendentes.length !== 1 ? "s" : ""} ainda{interrompida.filaIdsPendentes.length !== 1 ? "" : ""} sem terminar. Suas fotos já processadas foram salvas — posso retomar de onde parou (modo incremental, pula o que já foi feito).
              </p>
              <p className="text-amber-500 text-[11px] mt-1">
                Iniciada {tempoRelativo(interrompida.iniciadoEm)}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={retomarIndexacao}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-2">
              <Play size={13} /> Continuar
            </button>
            <button
              onClick={descartarRetomada}
              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-white transition">
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Banner: auto-iniciar indexação em N segundos */}
      {!interrompida && autoCountdown !== null && !autoCancelado && !ocupado && !indexandoTodos && (
        <div className="bg-[#EFF5FF] border-2 border-[#2E7DD1] rounded-2xl px-5 py-4 mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-[#2E7DD1] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#0D2B4E] text-sm">
                Indexação automática iniciando em <span className="text-[#2E7DD1]">{autoCountdown}s</span>
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {eventos.filter(e => e.folder_id && e.total_fotos > 0 && !statusIndex[e.id]).length} evento(s) sem índice — vou processar todos em sequência.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setAutoCancelado(true); setAutoCountdown(null); }}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-xs font-bold hover:bg-white transition shrink-0">
            Cancelar
          </button>
        </div>
      )}

      {/* Banner de fotos novas detectadas */}
      {reindexFlags.length > 0 && !ocupado && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">
                {reindexFlags.length} evento{reindexFlags.length > 1 ? "s" : ""} com fotos novas
              </p>
              <p className="text-amber-600 text-xs mt-0.5">
                {reindexFlags.map(f => `${f.eventoNome} (+${f.novas} fotos)`).join(" · ")}
              </p>
              <p className="text-amber-500 text-[11px] mt-1">
                Só as fotos novas serão processadas — o índice existente é mantido.
              </p>
            </div>
          </div>
          <button
            onClick={processarFlagsAuto}
            disabled={autoProcessando}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shrink-0 disabled:opacity-50"
          >
            {autoProcessando
              ? <Loader2 size={13} className="animate-spin" />
              : <Zap size={13} />}
            {autoProcessando ? "Processando..." : "Atualizar agora"}
          </button>
        </div>
      )}

      {/* Como funciona */}
      <div className="grid grid-cols-3 gap-3 mb-6 text-center">
        {[
          { icon: <ScanFace size={18} className="text-[#2E7DD1]" />, label: "Detecta rostos", sub: "em todas as fotos" },
          { icon: <Database size={18} className="text-emerald-500" />, label: "Salva índice", sub: "busca instantânea" },
          { icon: <Bell size={18} className="text-amber-500" />, label: "Notifica usuários", sub: "encontrados no evento" },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <div className="flex justify-center mb-1">{item.icon}</div>
            <p className="text-xs font-bold text-[#0D2B4E]">{item.label}</p>
            <p className="text-[11px] text-gray-400">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Seleção de evento */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <label className="block text-sm font-semibold text-[#0D2B4E] mb-2">
          Selecionar evento
        </label>
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          disabled={ocupado}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-[#0D2B4E] bg-[#F5F7FA] focus:outline-none focus:border-[#2E7DD1] transition disabled:opacity-50"
        >
          <option value="">— Escolha um evento —</option>
          {eventos
            .filter((e) => e.folder_id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} ({e.total_fotos} fotos)
                {statusIndex[e.id] ? " ✓ Indexado" : ""}
              </option>
            ))}
        </select>

        {/* Resultado salvo anteriormente */}
        {eventoId && resultadoSalvo && fase === "idle" && (
          <div className="mt-4 bg-[#F5F7FA] rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#0D2B4E] flex items-center gap-1.5">
                <Database size={14} className="text-emerald-500" /> Último resultado salvo
              </p>
              <span className="text-[11px] text-gray-400">
                {new Date(resultadoSalvo.processadoEm).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                <p className="text-lg font-black text-[#1A4A80]">{resultadoSalvo.totalFotos}</p>
                <p className="text-[10px] text-gray-400">Fotos</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                <p className="text-lg font-black text-emerald-600">{resultadoSalvo.fotosComRosto}</p>
                <p className="text-[10px] text-gray-400">Com rostos</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                <p className="text-lg font-black text-purple-600">{resultadoSalvo.usuarios.length}</p>
                <p className="text-[10px] text-gray-400">Usuários</p>
              </div>
            </div>
            {resultadoSalvo.usuarios.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {resultadoSalvo.usuarios.map(u => (
                  <div key={u.email} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-gray-100">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(u.nome || u.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0D2B4E] truncate">{u.nome}</p>
                      <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Images size={10} className="text-gray-300" />
                      <span className="text-[10px] text-gray-400">{u.fotosIds.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badge de status */}
        {eventoId && (
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
            ${statusIndex[eventoId]
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
            {statusIndex[eventoId]
              ? <><Zap size={11} /> Já indexado — reprocessar vai atualizar o índice</>
              : <><AlertCircle size={11} /> Ainda não indexado — buscas serão lentas</>}
          </div>
        )}

        {/* Contador de perfis cadastrados */}
        <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
          ${totalPerfis === null
            ? "bg-gray-100 text-gray-400"
            : totalPerfis === 0
            ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
          <Users size={11} />
          {totalPerfis === null
            ? "Verificando perfis..."
            : totalPerfis === 0
            ? "Nenhum usuário com rosto cadastrado"
            : `${totalPerfis} usuário${totalPerfis !== 1 ? "s" : ""} com rosto cadastrado`}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => iniciar()}
            disabled={!eventoId || ocupado || indexandoTodos || !evento?.folder_id}
            className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ocupado && !indexandoTodos
              ? <Loader2 size={16} className="animate-spin" />
              : <Play size={16} />}
            {ocupado && !indexandoTodos ? faseLabel[fase] : (statusIndex[eventoId] ? "Reindexar (completo)" : "Processar evento")}
          </button>

          <button
            onClick={() => indexarTodos()}
            disabled={ocupado || indexandoTodos || eventos.filter(e => e.folder_id && e.total_fotos > 0).length === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#2E7DD1] text-[#2E7DD1] font-bold text-sm hover:bg-[#EFF5FF] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {indexandoTodos
              ? <Loader2 size={16} className="animate-spin" />
              : <Layers size={16} />}
            {indexandoTodos
              ? `Indexando ${filaIdx} de ${filaTotal}...`
              : `Indexar todos (${eventos.filter(e => e.folder_id && e.total_fotos > 0).length} eventos)`}
          </button>
        </div>

        {/* Progresso da fila */}
        {indexandoTodos && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-[#F5F7FA] rounded-xl px-3 py-2 border border-gray-100">
            <Loader2 size={12} className="animate-spin text-[#2E7DD1] shrink-0" />
            <span>
              Evento <span className="font-bold text-[#0D2B4E]">{filaIdx}</span> de{" "}
              <span className="font-bold text-[#0D2B4E]">{filaTotal}</span>
              {ultimoEvento ? `: ${ultimoEvento}` : ""}
            </span>
            <div className="ml-auto flex gap-0.5">
              {Array.from({ length: filaTotal }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                  i < filaIdx - 1 ? "bg-emerald-400" :
                  i === filaIdx - 1 ? "bg-[#2E7DD1] animate-pulse" :
                  "bg-gray-200"
                }`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      {(fase === "processando" || fase === "salvando_index") && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#0D2B4E]">
              {fase === "salvando_index" ? "Salvando índice..." : <>Indexando <em>{ultimoEvento}</em></>}
            </span>
            <span className="text-[#2E7DD1] font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: "linear-gradient(to right,#1A4A80,#2E7DD1)" }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{progresso} de {total} fotos analisadas</span>
            <div className="flex items-center gap-3">
              {perfisCarregados > 0 && (
                <span className="text-purple-600 font-semibold">{perfisCarregados} usuário{perfisCarregados !== 1 ? "s" : ""} cadastrado{perfisCarregados !== 1 ? "s" : ""}</span>
              )}
              {fotosIndex > 0 && (
                <span className="text-emerald-600 font-semibold">{fotosIndex} com rostos detectados</span>
              )}
            </div>
          </div>
        </div>
      )}

      {fase === "notificando" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex items-center gap-3">
          <Bell size={18} className="text-[#2E7DD1] shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#0D2B4E]">Enviando notificações...</p>
            <p className="text-xs text-gray-400 mt-0.5">{notifSent} de {matches.length} usuários notificados</p>
          </div>
          <Loader2 size={16} className="animate-spin text-[#2E7DD1]" />
        </div>
      )}

      {/* Resumo final */}
      {fase === "done" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={20} className="text-emerald-500" />
            <span className="font-bold text-[#0D2B4E]">Processamento concluído</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-[#EFF5FF] rounded-xl p-3 text-center">
              <Camera size={16} className="text-[#2E7DD1] mx-auto mb-1" />
              <p className="text-xl font-black text-[#1A4A80]">{total}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Fotos</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <Database size={16} className="text-emerald-500 mx-auto mb-1" />
              <p className="text-xl font-black text-emerald-600">{fotosIndex}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Com rostos</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <Users size={16} className="text-purple-500 mx-auto mb-1" />
              <p className="text-xl font-black text-purple-600">{matches.length}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Usuários</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <Bell size={16} className="text-amber-500 mx-auto mb-1" />
              <p className="text-xl font-black text-amber-600">{notifSent}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Notificados</p>
            </div>
          </div>

          {/* Breakdown por canal */}
          {matches.length > 0 && (
            <div className={`grid ${emailTentado ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-3`}>
              {emailTentado && (
                <div className={`rounded-xl px-3 py-2 text-center border ${notifEmailOk === matches.length ? "bg-emerald-50 border-emerald-200" : notifEmailOk > 0 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email</p>
                  <p className={`text-sm font-black ${notifEmailOk === matches.length ? "text-emerald-700" : notifEmailOk > 0 ? "text-amber-700" : "text-red-700"}`}>
                    {notifEmailOk} / {matches.length}
                  </p>
                </div>
              )}
              <div className={`rounded-xl px-3 py-2 text-center border ${notifSiteOk === matches.length ? "bg-emerald-50 border-emerald-200" : notifSiteOk > 0 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sininho</p>
                <p className={`text-sm font-black ${notifSiteOk === matches.length ? "text-emerald-700" : notifSiteOk > 0 ? "text-amber-700" : "text-red-700"}`}>
                  {notifSiteOk} / {matches.length}
                </p>
              </div>
            </div>
          )}

          {/* Lista de falhas */}
          {notifFalhas.length > 0 && (
            <details className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
              <summary className="text-red-700 text-xs font-bold cursor-pointer flex items-center gap-1.5">
                <AlertCircle size={12} /> {notifFalhas.length} falha{notifFalhas.length !== 1 ? "s" : ""} — clique para detalhes
              </summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {notifFalhas.map((f, i) => (
                  <div key={i} className="text-[11px] text-red-700 bg-white border border-red-100 rounded-lg px-2 py-1">
                    <span className="font-bold">{f.email}</span>
                    <span className="ml-1 text-red-400">[{f.canal}{f.status ? ` ${f.status}` : ""}]</span>
                    {f.erro && <span className="block text-red-500 text-[10px] mt-0.5">{f.erro}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Destaque: índice salvo */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4">
            <Zap size={15} className="text-emerald-600 shrink-0" />
            <p className="text-emerald-700 text-xs font-semibold">
              Índice salvo! As buscas neste evento agora são instantâneas para todos os usuários.
            </p>
          </div>

          {/* Aviso se nenhum perfil foi carregado */}
          {perfisCarregados === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">
                <span className="font-bold">Nenhum perfil com rosto foi carregado.</span>{" "}
                Os usuários precisam cadastrar o rosto em <em>Cadastrar Rosto</em> antes do reconhecimento.
              </p>
            </div>
          )}

          {matches.length === 0 && perfisCarregados > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">
                <span className="font-bold">{perfisCarregados} perfil{perfisCarregados !== 1 ? "s" : ""} com rosto carregado{perfisCarregados !== 1 ? "s" : ""}, mas nenhum encontrado nas fotos.</span>{" "}
                Isso pode acontecer se a selfie cadastrada for muito diferente das fotos do evento, ou se a pessoa não aparece nas fotos.
              </p>
            </div>
          )}

          <button
            onClick={() => { setFase("idle"); setMatches([]); setFotosIndex(0); }}
            className="flex items-center gap-2 text-[#2E7DD1] text-sm font-semibold hover:underline mt-2"
          >
            <RefreshCw size={13} /> Processar outro evento
          </button>
        </div>
      )}

      {/* Lista de usuários encontrados */}
      {matches.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2B4E] mb-4 flex items-center gap-2 text-sm">
            <Users size={15} className="text-[#2E7DD1]" /> Usuários encontrados
          </h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.email} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] border border-gray-100">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shrink-0 shadow text-white text-sm font-bold">
                  {(m.nome || m.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D2B4E] truncate">{m.nome || m.email}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {m.email} · {m.fotosIds.length} foto{m.fotosIds.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {m.notificado
                  ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                  : <Loader2 size={16} className="text-gray-300 animate-spin shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Histórico de Indexações ─────────────────────────────── */}
      {historico.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="font-bold text-[#0D2B4E] mb-4 flex items-center gap-2 text-sm">
            <Clock size={15} className="text-[#2E7DD1]" /> Histórico de Indexações
          </h2>
          <div className="space-y-3">
            {historico.map(item => {
              const notifState = notifHistorico[item.eventoId] ?? "idle";
              return (
                <div key={item.eventoId} className="rounded-xl border border-gray-100 bg-[#F5F7FA] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#0D2B4E] truncate">{item.eventoNome}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock size={9} /> {tempoRelativo(item.processadoEm)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Camera size={9} /> {item.fotosComRosto} fotos c/ rosto
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-purple-600 font-semibold">
                          <Users size={9} /> {item.usuarios.length} usuário{item.usuarios.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {item.usuarios.length > 0 && (
                      <button
                        onClick={() => notificarEvento(item)}
                        disabled={notifState === "enviando"}
                        title="Notificar usuários encontrados neste evento"
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition
                          ${notifState === "ok"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "border border-[#2E7DD1] text-[#2E7DD1] hover:bg-[#EFF5FF]"}
                          disabled:opacity-50`}
                      >
                        {notifState === "enviando"
                          ? <><Loader2 size={11} className="animate-spin" /> Enviando...</>
                          : notifState === "ok"
                          ? <><CheckCircle size={11} /> Enviado</>
                          : <><Send size={11} /> Notificar</>}
                      </button>
                    )}
                  </div>

                  {/* Mini lista de usuários */}
                  {item.usuarios.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.usuarios.map(u => (
                        <span key={u.email} className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-2 py-0.5 text-[10px] text-gray-600">
                          <div className="w-3.5 h-3.5 rounded-full gradient-primary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 7 }}>
                            {(u.nome || u.email)[0].toUpperCase()}
                          </div>
                          <span className="truncate max-w-[100px]">{u.nome || u.email}</span>
                          <span className="text-gray-400">{u.fotosIds.length}f</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Diagnóstico de notificações ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <h2 className="font-bold text-[#0D2B4E] mb-2 flex items-center gap-2 text-sm">
          <Bell size={15} className="text-[#2E7DD1]" /> Diagnosticar notificações
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Digite o email do usuário pra ver as notificações dele e/ou disparar um teste manual.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={diagEmail}
            onChange={e => setDiagEmail(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2E7DD1]"
          />
          <button
            onClick={diagConsultar}
            disabled={!diagEmail.trim() || diagLoading}
            className="px-4 py-2 rounded-xl border border-[#2E7DD1] text-[#2E7DD1] text-xs font-bold hover:bg-[#EFF5FF] transition disabled:opacity-40">
            {diagLoading ? "..." : "Ver notifs"}
          </button>
          <button
            onClick={diagEnviarTeste}
            disabled={!diagEmail.trim()}
            className="px-4 py-2 rounded-xl gradient-primary text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-40">
            Enviar teste
          </button>
        </div>

        {diagErro && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs">
            <strong>Erro:</strong> {diagErro}
          </div>
        )}

        {diagTeste && (
          <div className={`rounded-xl px-3 py-2 text-xs ${diagTeste.status === 200 ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            <strong>Teste enviado:</strong> HTTP {diagTeste.status}
            {diagTeste.body && <div className="mt-1 font-mono text-[10px] opacity-70">{diagTeste.body}</div>}
            {diagTeste.status === 200 && (
              <div className="mt-2 text-[11px]">
                ✓ Gravado no Drive. Clique &quot;Ver notifs&quot; agora pra confirmar leitura.
              </div>
            )}
          </div>
        )}

        {diagNotifs !== null && (
          <div className="mt-3 bg-[#F5F7FA] rounded-xl border border-gray-100 p-3">
            <p className="text-xs font-bold text-[#0D2B4E] mb-2">
              {diagNotifs.length} notificação(ões) encontrada(s) para <code className="text-[#2E7DD1]">{diagEmail}</code>
            </p>
            {diagNotifs.length === 0 ? (
              <p className="text-amber-700 text-xs">
                ⚠ Nenhuma notif retornada. Possíveis causas: (1) email gravado com formato diferente — confira normalização; (2) admin não rodou indexação com matching; (3) usuário não foi achado nas fotos.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {diagNotifs.map(n => (
                  <div key={n.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0D2B4E]">{n.titulo}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${n.lida ? "bg-gray-100 text-gray-500" : "bg-[#2E7DD1] text-white"}`}>
                        {n.lida ? "LIDA" : "NÃO LIDA"}
                      </span>
                    </div>
                    <p className="text-gray-500 mt-0.5">{n.mensagem}</p>
                    <p className="text-gray-300 mt-0.5">{new Date(n.criada_em).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Erro */}
      {fase === "erro" && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro durante o processamento</p>
            <p className="text-red-400 text-xs mt-1">{erro}</p>
            <button onClick={() => setFase("idle")} className="mt-2 text-red-500 font-semibold hover:underline text-xs">
              Tentar novamente
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
