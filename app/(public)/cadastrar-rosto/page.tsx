"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Scan, Shield, CheckCircle, X, Loader2,
  ClipboardPaste, ArrowRight, User, Mail, Calendar,
  Images, Zap, Search, Camera, ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ToastProvider";
import { salvarDescriptor, adicionarDescriptor, salvarCacheMinhasFotos, lerDescriptors, menorDistancia } from "@/lib/minhasFotos";
import { useSearchParams } from "next/navigation";
import { fetchDescritores } from "@/lib/descritoresCache";
import { lerRecognitionThresholdLocal } from "@/lib/recognition-thresholds";

type EtapaID = "email" | "checking" | "nome" | "pronto";

interface EventoPicker {
  id: string;
  nome: string;
  data: string;
  total_fotos: number;
  folder_id?: string;
  indexado: boolean;
  coverFotoId?: string;
  capa_id?: string;
}

function PassosCadastro({ atual }: { atual: 1 | 2 | 3 }) {
  const passos = [
    { titulo: "Perfil", detalhe: "Nome e email" },
    { titulo: "Selfie", detalhe: "Seu rosto" },
    { titulo: "Pronto", detalhe: "Avisos ativos" },
  ];

  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#2E7DD1]/15 bg-white shadow-sm sm:grid-cols-3">
      {passos.map((passo, index) => {
        const numero = index + 1;
        const concluido = numero < atual;
        const ativo = numero === atual;
        return (
          <div key={passo.titulo} className={`flex items-center gap-3 border-b border-[#2E7DD1]/10 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${ativo ? "bg-[#EFF5FF]" : ""}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${concluido ? "bg-emerald-500 text-white" : ativo ? "bg-[#2167AE] text-white shadow" : "bg-gray-100 text-gray-400"}`}>
              {concluido ? <CheckCircle size={17} /> : numero}
            </span>
            <span>
              <strong className="block text-sm text-[#0D2B4E]">{passo.titulo}</strong>
              <small className="text-xs text-gray-400">{passo.detalhe}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CabecalhoCadastro({ modoAdicionar = false }: { modoAdicionar?: boolean }) {
  if (modoAdicionar) {
    return (
      <header className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Zap size={13} /> Aumentar precisão
          </span>
          <h1 className="text-2xl font-black text-[#0D2B4E] lg:text-4xl">
            Adicione mais uma selfie
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Cada selfie nova ajuda a IA a te reconhecer em ângulos, iluminação ou expressões diferentes.
            Suas selfies anteriores continuam ativas — esta é somada ao seu perfil.
          </p>
        </div>
      </header>
    );
  }
  return (
    <header className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#2E7DD1]/15 bg-[#EFF5FF] px-3 py-1.5 text-xs font-bold text-[#1A4A80]">
          <Shield size={13} /> Cadastro do seu perfil
        </span>
        <h1 className="text-2xl font-black text-[#0D2B4E] lg:text-4xl">Cadastre seu rosto uma vez</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Esta selfie fica ligada ao seu perfil para encontrar suas fotos e avisar voce quando o motor reconhecer voce em um evento.
        </p>
      </div>
      <a href="/buscar-pessoa" className="rounded-2xl border border-[#2E7DD1]/20 bg-white px-4 py-3 text-sm font-bold text-[#2E7DD1] shadow-sm transition hover:bg-[#EFF5FF]">
        Buscar com outra foto
      </a>
    </header>
  );
}

export default function CadastrarRostoPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  // Modo "adicionar" — somar uma selfie nova ao pool de descritores em vez de substituir.
  const modoAdicionar = searchParams.get("adicionar") === "1";

  // Identificação
  const [etapa,          setEtapa]          = useState<EtapaID>("email");
  const [emailDigitado,  setEmailDigitado]  = useState("");
  const [nomeDigitado,   setNomeDigitado]   = useState("");
  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);

  // Upload / processamento
  const [preview,  setPreview]  = useState<string | null>(null);
  const [status,   setStatus]   = useState<"idle"|"loading-models"|"detecting"|"buscando"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pasted,   setPasted]   = useState(false);
  const inputRef        = useRef<HTMLInputElement>(null);
  const cameraRef       = useRef<HTMLInputElement>(null);
  const galeriaRef      = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  // Seleção de eventos
  const [showPicker,    setShowPicker]    = useState(false);
  const [eventosPicker, setEventosPicker] = useState<EventoPicker[]>([]);
  const [selecionados,  setSelecionados]  = useState<Set<string>>(new Set());
  const [descPendente,  setDescPendente]  = useState<{ arr: number[]; email: string; thumb: string } | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem("usuario_simples");
        if (raw) {
          const u = JSON.parse(raw);
          setUsuarioSimples(u);
          setEtapa("pronto");
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (preview) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            setPreview(src);
            setPasted(true);
            setStatus("idle");
            setErrorMsg("");
            handleProcess(src);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [preview]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setPreview(src);
      setPasted(false);
      setStatus("idle");
      setErrorMsg("");
      handleProcess(src);
    };
    reader.readAsDataURL(file);
  }

  async function verificarEmail() {
    const email = emailDigitado.trim().toLowerCase();
    if (!email.includes("@")) return;
    setEtapa("checking");
    try {
      const res  = await fetch(`/api/perfil?email=${encodeURIComponent(email)}`);
      const data = res.ok ? await res.json() : null;
      if (data?.nome) {
        const u = { nome: data.nome, email };
        localStorage.setItem("usuario_simples", JSON.stringify(u));
        setUsuarioSimples(u);
        setEtapa("pronto");
      } else {
        setEtapa("nome");
      }
    } catch {
      setEtapa("nome");
    }
  }

  async function confirmarNome() {
    const nome  = nomeDigitado.trim();
    const email = emailDigitado.trim().toLowerCase();
    if (!nome || !email) return;
    const u = { nome, email };
    localStorage.setItem("usuario_simples", JSON.stringify(u));
    setUsuarioSimples(u);
    setEtapa("pronto");
    fetch("/api/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_simples: email, nome_simples: nome }),
    }).catch(() => {});
  }

  function sair() {
    localStorage.removeItem("usuario_simples");
    setUsuarioSimples(null);
    setEmailDigitado("");
    setNomeDigitado("");
    setEtapa("email");
  }

  function gerarThumb(src: string, maxPx = 120): Promise<string> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  /* ── Carrega lista de eventos com status de indexação ── */
  async function carregarEventosPicker(): Promise<EventoPicker[]> {
    const res = await fetch("/api/eventos").catch(() => null);
    if (!res?.ok) return [];
    const lista = await res.json();

    // 10 eventos mais recentes com pasta
    const ativos = (lista as EventoPicker[])
      .filter(e => e.folder_id && e.total_fotos > 0)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 10);

    const com = await Promise.all(ativos.map(async (ev) => {
      const j = await fetchDescritores(ev.id);
      const indexado = !!(j?.indexado && Array.isArray(j.dados) && j.dados.length > 0);
      const coverFotoId = indexado && j?.dados?.[0]?.fotoId ? j.dados[0].fotoId : undefined;
      return { ...ev, indexado, coverFotoId };
    }));

    return com;
  }

  /* ── Busca rosto nos eventos selecionados ── */
  const buscarEmEventos = useCallback(async (
    descriptorArr: number[],
    email: string,
    eventoIds: string[],
    todosPicker: EventoPicker[],
  ): Promise<number> => {
    try {
      const alvo = todosPicker.filter(e => eventoIds.includes(e.id));
      const matches: string[] = [];
      const porEvento: { eventoId: string; eventoNome: string; fotos: string[] }[] = [];

      // ── 1. Fotos confirmadas no Drive (fonte primária) ──────────
      if (email) {
        const driveRes = await fetch(`/api/meu/fotos?email=${encodeURIComponent(email)}`).catch(() => null);
        if (driveRes?.ok) {
          const driveData = await driveRes.json();
          if (driveData?.eventos?.length) {
            for (const ev of alvo) {
              const evMatch = driveData.eventos.find((e: { eventoId: string; fotoIds: string[] }) => e.eventoId === ev.id);
              if (evMatch?.fotoIds?.length) {
                matches.push(...evMatch.fotoIds.filter((id: string) => !matches.includes(id)));
                porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: evMatch.fotoIds });
              }
            }
          }
        }
      }

      // ── 2. Índice de descritores (para eventos indexados sem fotos confirmadas) ──
      if (matches.length < 30) {
        // Usa TODOS os descriptors do usuário: local + servidor (multi-selfie)
        const descritoresUser = lerDescriptors().map(f => Array.from(f));
        if (descritoresUser.length === 0) descritoresUser.push(descriptorArr);
        // Inclui também os do servidor (caso local esteja desatualizado)
        if (email) {
          try {
            const r = await fetch(`/api/perfil?email=${encodeURIComponent(email)}`);
            if (r.ok) {
              const p = await r.json();
              const serverDescs: number[][] = Array.isArray(p?.descriptors) && p.descriptors.length > 0
                ? p.descriptors
                : Array.isArray(p?.descriptor) ? [p.descriptor] : [];
              for (const d of serverDescs) {
                const dup = descritoresUser.some(loc => Math.abs(loc[0] - d[0]) < 0.0001);
                if (!dup) descritoresUser.push(d);
              }
            }
          } catch { /* segue só com local */ }
        }
        interface FotoDesc { fotoId: string; rostos: { descriptor: number[] }[] }
        const LIMIAR = lerRecognitionThresholdLocal("resultado");
        const eventosResolvidosPgvector = new Set<string>();

        try {
          const buscaRes = await fetch("/api/pessoas/buscar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventoIds: alvo
                .filter(ev => !porEvento.some(p => p.eventoId === ev.id))
                .map(ev => ev.id),
              descriptors: descritoresUser,
              threshold: LIMIAR,
            }),
          });
          const buscaData = buscaRes.ok ? await buscaRes.json() : null;
          const fotosPgvector = new Map<string, string[]>();

          if (Array.isArray(buscaData?.matches)) {
            for (const match of buscaData.matches as { eventoId: string; fotoId: string }[]) {
              if (matches.length >= 30) break;
              if (typeof match?.eventoId !== "string" || typeof match?.fotoId !== "string") continue;
              if (matches.includes(match.fotoId)) continue;
              matches.push(match.fotoId);
              const fotosEvento = fotosPgvector.get(match.eventoId) ?? [];
              fotosEvento.push(match.fotoId);
              fotosPgvector.set(match.eventoId, fotosEvento);
            }
          }

          for (const [eventoId, fotosEvento] of fotosPgvector) {
            const ev = alvo.find(item => item.id === eventoId);
            if (!ev || fotosEvento.length === 0) continue;
            porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: fotosEvento });
            eventosResolvidosPgvector.add(ev.id);
          }
        } catch { /* fallback abaixo */ }

        for (const ev of alvo) {
          if (matches.length >= 30) break;
          if (porEvento.some(p => p.eventoId === ev.id)) continue; // já veio do Drive
          if (eventosResolvidosPgvector.has(ev.id)) continue;

          // Fallback: descritores soltos para eventos fora do pgvector.
          const json = await fetchDescritores(ev.id);
          if (!json?.indexado || !Array.isArray(json.dados)) continue;
          const descritoresUserF32 = descritoresUser.map(d => new Float32Array(d));

          const fotosEvento: string[] = [];
          for (const foto of json.dados as FotoDesc[]) {
            let melhor = Infinity;
            for (const rosto of foto.rostos) {
              const d = menorDistancia(descritoresUserF32, rosto.descriptor);
              if (d < melhor) melhor = d;
            }
            if (melhor < LIMIAR && !matches.includes(foto.fotoId)) {
              matches.push(foto.fotoId);
              fotosEvento.push(foto.fotoId);
            }
          }
          if (fotosEvento.length) {
            porEvento.push({ eventoId: ev.id, eventoNome: ev.nome, fotos: fotosEvento });
          }
        }
      }

      // Sempre sobrescreve o cache (mesmo vazio) pra evitar dados de busca anterior
      if (email) {
        salvarCacheMinhasFotos(email, {
          matches: matches.map(id => ({ id, distancia: 0.5 })),
          porEvento,
        });
      }
      return matches.length;
    } catch { return 0; }
  }, []);

  /* ── Processa selfie com face-api ── */
  async function handleProcess(imageSrc?: string) {
    const src = imageSrc ?? preview;
    if (!src) return;
    try {
      setStatus("loading-models");
      const { loadFaceModels, detectorOptions } = await import("@/lib/faceapi-loader");
      const faceapi = await loadFaceModels();
      setStatus("detecting");

      const img = await faceapi.fetchImage(src);
      // Detecta TODAS as faces e escolhe a maior (= mais perto da camera,
      // provavelmente o usuario). Robusto a selfies com gente atras.
      const todas = await faceapi
        .detectAllFaces(img, detectorOptions(faceapi, 0.4))
        .withFaceLandmarks(false)
        .withFaceDescriptors();

      if (!todas?.length) {
        setStatus("error");
        setErrorMsg("Nenhum rosto detectado. Use uma selfie com rosto de frente, bem iluminado e ocupando boa parte da imagem.");
        return;
      }

      // Pega a face com maior area (width * height)
      const detection = todas.reduce((maior, cur) =>
        (cur.detection.box.width * cur.detection.box.height) >
        (maior.detection.box.width * maior.detection.box.height) ? cur : maior
      );

      // Validação de qualidade
      const score = detection.detection.score;
      const box   = detection.detection.box;
      const minDim = Math.min(img.width || 300, img.height || 300);
      const faceCobertura = Math.min(box.width, box.height) / minDim;

      if (faceCobertura < 0.12) {
        setStatus("error");
        setErrorMsg("Rosto muito pequeno na foto. Aproxime-se mais da câmera para que seu rosto ocupe pelo menos 1/4 da imagem.");
        return;
      }
      if (score < 0.40) {
        setStatus("error");
        setErrorMsg("Selfie com baixa nitidez. Use uma foto bem iluminada, de frente e sem sombras no rosto.");
        return;
      }

      const descriptorArr = Array.from(detection.descriptor);
      const thumbRastreio = await gerarThumb(src, 120);
      const emailUsuario  = session?.user?.email ?? usuarioSimples?.email ?? "";

      // Salva descriptor: modo "adicionar" SOMA ao pool; padrao SUBSTITUI.
      // Mais selfies salvas = mais chances de bater (a busca usa menorDistancia
      // entre TODOS os descritores do usuario).
      if (modoAdicionar) {
        adicionarDescriptor(descriptorArr);
      } else {
        salvarDescriptor(descriptorArr, emailUsuario || undefined);
      }

      // Carrega eventos enquanto o usuário vê o rosto detectado
      setStatus("buscando");
      const eventos = await carregarEventosPicker();
      setStatus("idle");

      if (eventos.length === 0) {
        // Sem eventos — salva perfil direto e redireciona
        await salvarPerfil(descriptorArr, thumbRastreio, emailUsuario, 0);
        return;
      }

      // Abre picker para o usuário escolher os eventos
      setDescPendente({ arr: descriptorArr, email: emailUsuario, thumb: thumbRastreio });
      setEventosPicker(eventos);
      setSelecionados(new Set(eventos.map(e => e.id))); // todos selecionados por padrão
      setShowPicker(true);

    } catch (err) {
      setStatus("error");
      setErrorMsg("Erro ao processar imagem. Tente novamente.");
      console.error(err);
    }
  }

  /* ── Salva perfil no servidor e redireciona ── */
  async function salvarPerfil(
    descriptorArr: number[],
    thumb: string,
    emailUsuario: string,
    totalAchadas: number,
  ) {
    const nomeUsuario = session?.user?.name ?? usuarioSimples?.nome ?? "Você";
    const bodyPerfil: Record<string, unknown> = {
      descriptor:    descriptorArr,
      foto_rastreio: thumb,
    };
    if (!session?.user?.email && usuarioSimples?.email) {
      bodyPerfil.email_simples = usuarioSimples.email;
      bodyPerfil.nome_simples  = usuarioSimples.nome ?? "";
    }

    fetch("/api/perfil", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(bodyPerfil),
    }).then(async (r) => {
      if (!r.ok) return;
      toast({
        tipo:      "sucesso",
        titulo:    totalAchadas > 0 ? `Encontramos ${totalAchadas} fotos suas! 🎉` : "Rosto cadastrado!",
        mensagem:  totalAchadas > 0 ? "Suas fotos já aparecem em Minhas fotos." : "Você será avisado quando aparecer em eventos.",
        link:      totalAchadas > 0 ? "/resultado" : undefined,
        linkLabel: totalAchadas > 0 ? "Ver minhas fotos" : undefined,
        duracao:   7000,
      });
      if (emailUsuario && totalAchadas > 0) {
        fetch("/api/notificacoes", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:    emailUsuario,
            tipo:     "fotos_encontradas",
            titulo:   `Encontramos ${totalAchadas} fotos suas!`,
            mensagem: `Olá, ${nomeUsuario.split(" ")[0]}! Clique para ver suas fotos.`,
            link:     "/resultado",
          }),
        }).catch(() => {});
      }
    }).catch(() => {});

    setStatus("done");
    router.push("/perfil?novo=1");
  }

  /* ── Confirma seleção de eventos e roda a busca ── */
  async function confirmarBusca() {
    if (!descPendente) return;
    setShowPicker(false);
    setStatus("buscando");

    const totalAchadas = selecionados.size > 0
      ? await buscarEmEventos(descPendente.arr, descPendente.email, Array.from(selecionados), eventosPicker)
      : 0;

    await salvarPerfil(descPendente.arr, descPendente.thumb, descPendente.email, totalAchadas);
  }

  function toggleEvento(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === eventosPicker.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(eventosPicker.map(e => e.id)));
    }
  }

  const processing  = status === "loading-models" || status === "detecting" || status === "buscando";
  const statusLabel = {
    "idle":           "",
    "loading-models": "Carregando modelos de IA...",
    "detecting":      "Analisando seu rosto...",
    "buscando":       "Carregando eventos...",
    "done":           "Pronto! Redirecionando...",
    "error":          errorMsg,
  }[status];

  const usuarioAtivo = session?.user
    ? { nome: session.user.name ?? "", email: session.user.email ?? "" }
    : usuarioSimples;

  if (sessionStatus === "loading") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-[#2E7DD1]" />
    </div>
  );

  /* ─────────────── IDENTIFICAÇÃO ─────────────── */
  if (!usuarioAtivo) return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <CabecalhoCadastro modoAdicionar={modoAdicionar} />
      <PassosCadastro atual={1} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.92fr]">
      <div className="w-full rounded-3xl border border-[#2E7DD1]/15 bg-white p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Scan size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#0D2B4E] mb-1 text-center">Identificação</h2>
        <p className="text-gray-400 text-sm mb-6 text-center leading-relaxed">
          Digite seu email para continuar.<br />Se já usou antes, entra direto.
        </p>

        {(etapa === "email" || etapa === "checking") && (
          <>
            <div className="relative mb-4">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email" placeholder="seu@email.com"
                value={emailDigitado}
                onChange={e => setEmailDigitado(e.target.value)}
                onKeyDown={e => e.key === "Enter" && verificarEmail()}
                autoFocus
                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
              />
            </div>
            <button onClick={verificarEmail}
              disabled={etapa === "checking" || !emailDigitado.includes("@")}
              className="w-full py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow disabled:opacity-40 transition flex items-center justify-center gap-2">
              {etapa === "checking"
                ? <><Loader2 size={16} className="animate-spin" /> Verificando...</>
                : <><ArrowRight size={15} /> Continuar</>}
            </button>
          </>
        )}

        {etapa === "nome" && (
          <>
            <div className="flex items-center gap-2 bg-[#EFF5FF] rounded-xl px-3 py-2 mb-4">
              <Mail size={13} className="text-[#2E7DD1] shrink-0" />
              <span className="text-[#1A4A80] text-sm font-medium truncate">{emailDigitado}</span>
              <button onClick={() => setEtapa("email")} className="ml-auto text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-3 text-center">
              Primeira vez por aqui! Como quer ser chamado?
            </p>
            <div className="relative mb-4">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Seu nome"
                value={nomeDigitado}
                onChange={e => setNomeDigitado(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmarNome()}
                autoFocus
                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
              />
            </div>
            <button onClick={confirmarNome} disabled={!nomeDigitado.trim()}
              className="w-full py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow disabled:opacity-40 transition flex items-center justify-center gap-2">
              <CheckCircle size={15} /> Pronto, vamos lá!
            </button>
          </>
        )}

        <p className="text-gray-300 text-xs mt-5 flex items-center justify-center gap-1.5">
          <Shield size={12} /> Seus dados são protegidos
        </p>
      </div>
      <aside className="rounded-3xl border border-[#2E7DD1]/15 bg-[#F5F9FF] p-6 shadow-sm">
        <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center rounded-full border-4 border-[#2E7DD1]/25 bg-white shadow-inner">
          <User size={62} className="text-[#2E7DD1]/45" />
        </div>
        <h2 className="text-lg font-bold text-[#0D2B4E]">Depois vem sua selfie</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Use uma foto sua com rosto de frente. Ela vira a referencia do seu perfil para comparar com os rostos dos eventos.
        </p>
        <div className="mt-4 grid gap-2 text-xs font-semibold text-[#1A4A80]">
          <span className="rounded-xl bg-white px-3 py-2">Recebe notificacoes quando encontrar voce</span>
          <span className="rounded-xl bg-white px-3 py-2">Buscar por amigos fica separado</span>
        </div>
      </aside>
      </div>
    </div>
  );

  /* ─────────────── UPLOAD + PROCESSAMENTO ─────────────── */
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <CabecalhoCadastro modoAdicionar={modoAdicionar} />
      <div className="mb-6">
        <PassosCadastro atual={2} />
      </div>

      {/* Banner usuário identificado */}
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-6">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
          {(usuarioAtivo.nome[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-emerald-800 font-semibold text-sm truncate">{usuarioAtivo.nome}</p>
          <p className="text-emerald-600 text-xs truncate">{usuarioAtivo.email}</p>
        </div>
        <CheckCircle size={18} className="text-emerald-500 shrink-0" />
        {!session?.user && (
          <button onClick={sair} className="text-emerald-500 hover:text-red-400 transition ml-1" title="Trocar conta">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow">
          <Scan size={32} className="text-white" />
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold text-[#0D2B4E] mb-2">Agora cadastre sua selfie</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Esta foto fica no seu perfil de reconhecimento. Para procurar outra pessoa, use a busca livre.
        </p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        {!preview ? (
          <div className="flex flex-col items-center gap-4">
            {/* Mobile: dois botões grandes — Câmera e Galeria */}
            <div className="grid grid-cols-2 gap-3 w-full sm:hidden">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-[#2E7DD1]/40 active:bg-[#EFF5FF] transition"
              >
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center shadow">
                  <Camera size={22} className="text-white" />
                </div>
                <span className="font-semibold text-[#0D2B4E] text-sm">Tirar foto</span>
                <span className="text-gray-400 text-[11px]">câmera frontal</span>
              </button>
              <button
                onClick={() => galeriaRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-[#2E7DD1]/40 active:bg-[#EFF5FF] transition"
              >
                <div className="w-12 h-12 rounded-full bg-[#EFF5FF] border border-[#2E7DD1]/30 flex items-center justify-center">
                  <ImageIcon size={22} className="text-[#2E7DD1]" />
                </div>
                <span className="font-semibold text-[#0D2B4E] text-sm">Da galeria</span>
                <span className="text-gray-400 text-[11px]">escolher foto</span>
              </button>
            </div>

            {/* Desktop: área de clique/drop normal */}
            <div
              onClick={() => inputRef.current?.click()}
              className="hidden sm:flex flex-col items-center justify-center gap-4 w-full border-2 border-dashed border-[#2E7DD1]/40 rounded-2xl p-12 cursor-pointer hover:border-[#2E7DD1] hover:bg-[#EFF5FF] transition group"
            >
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow group-hover:scale-105 transition">
                <Upload size={28} className="text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#0D2B4E] text-sm">Clique para enviar sua selfie</p>
                <p className="text-gray-400 text-xs mt-1">JPG, PNG · Rosto bem iluminado e de frente</p>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <ClipboardPaste size={13} className="text-[#2E7DD1]" />
                  <span className="text-[#2E7DD1] text-xs font-medium">ou cole um print com</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#EFF5FF] border border-[#2E7DD1]/30 text-[#1A4A80] text-xs font-mono">Ctrl+V</kbd>
                </div>
              </div>
            </div>

            {/* Inputs ocultos */}
            <input ref={inputRef}   type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <input ref={cameraRef}  type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
            <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className={`w-40 h-40 rounded-full overflow-hidden border-4 shadow-lg transition-colors
                ${status === "done" ? "border-emerald-400" : status === "error" ? "border-red-400" : "border-[#2E7DD1]"}`}>
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              {processing && (
                <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-[#5BA4E5]">
                  <div className="face-scan-line absolute w-full h-0.5 bg-gradient-to-r from-transparent via-[#5BA4E5] to-transparent" />
                </div>
              )}
              {!processing && (
                <button
                  onClick={() => { setPreview(null); setStatus("idle"); }}
                  className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow hover:bg-red-600 transition"
                >
                  <X size={14} className="text-white" />
                </button>
              )}
            </div>
            <div className="text-center">
              {status === "idle" && (
                <p className="text-[#0D2B4E] font-semibold text-sm flex items-center gap-1.5 justify-center">
                  <CheckCircle size={15} className="text-emerald-500" />
                  {pasted ? "Print colado com sucesso" : "Foto carregada com sucesso"}
                </p>
              )}
              {processing && (
                <div className="flex items-center gap-2 text-[#2E7DD1] font-semibold text-sm">
                  <Loader2 size={16} className="animate-spin" /> {statusLabel}
                </div>
              )}
              {status === "done" && (
                <p className="text-emerald-600 font-semibold text-sm flex items-center gap-1.5 justify-center">
                  <CheckCircle size={15} /> {statusLabel}
                </p>
              )}
              {status === "error" && (
                <p className="text-red-500 font-semibold text-sm text-center max-w-xs">{statusLabel}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Privacidade */}
      <div className="flex items-start gap-3 bg-[#EFF5FF] rounded-xl px-4 py-3 mb-6 border border-[#2E7DD1]/15">
        <Shield size={16} className="text-[#2E7DD1] mt-0.5 shrink-0" />
        <p className="text-[#1A4A80] text-xs leading-relaxed">
          <span className="font-semibold">Processamento local.</span> Seu rosto é analisado diretamente no seu dispositivo — nenhuma imagem é enviada para servidores externos.
        </p>
      </div>

      {/* Botão */}
      <button
        onClick={handleProcess}
        disabled={!preview || processing || status === "done"}
        className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing
          ? <><Loader2 size={18} className="animate-spin" /> Processando...</>
          : <><Scan size={18} /> Encontrar minhas fotos</>}
      </button>

      {/* ── POPUP: Seleção de Eventos ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:w-[70vw] sm:max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header modal */}
            <div className="flex items-start gap-3 p-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow shrink-0">
                <Search size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#0D2B4E] text-base">Em quais eventos você foi?</h3>
                <p className="text-gray-400 text-xs mt-0.5">Selecione os eventos para buscar suas fotos</p>
              </div>
              <button onClick={() => setShowPicker(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
                <X size={16} />
              </button>
            </div>

            {/* Selecionar todos */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {selecionados.size} de {eventosPicker.length} selecionados
              </span>
              <button onClick={toggleTodos}
                className="text-[#2E7DD1] text-xs font-semibold hover:underline">
                {selecionados.size === eventosPicker.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>

            {/* Lista de eventos */}
            <div className="overflow-y-auto flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {eventosPicker.map(ev => {
                const sel = selecionados.has(ev.id);
                const capaId = ev.capa_id || ev.coverFotoId;
                return (
                  <button
                    key={ev.id}
                    onClick={() => toggleEvento(ev.id)}
                    className={`relative rounded-xl overflow-hidden border-2 text-left transition-all duration-200
                      ${sel
                        ? "border-[#2E7DD1] shadow-lg ring-2 ring-[#2E7DD1]/20"
                        : "border-gray-200 opacity-60 hover:opacity-80"}`}
                  >
                    {/* Capa */}
                    <div className="relative h-28 overflow-hidden bg-[#0D2B4E]">
                      {capaId ? (
                        <img
                          src={`/api/thumb?id=${capaId}&sz=300`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full gradient-primary" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                      {/* Badge indexado */}
                      {ev.indexado && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-yellow-400/90 px-1.5 py-0.5 rounded-full">
                          <Zap size={8} className="text-yellow-900" />
                          <span className="text-[8px] text-yellow-900 font-bold">Rápido</span>
                        </div>
                      )}

                      {/* Checkbox */}
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                        ${sel ? "bg-[#2E7DD1] border-[#2E7DD1]" : "bg-white/70 border-white/50"}`}>
                        {sel && <CheckCircle size={12} className="text-white" />}
                      </div>

                      {/* Nome sobre a capa */}
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                        <p className="font-bold text-white text-[11px] leading-snug line-clamp-2 drop-shadow">{ev.nome}</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      {ev.data && (
                        <span className="flex items-center gap-0.5 text-gray-400 text-[10px]">
                          <Calendar size={8} /> {new Date(ev.data).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-gray-400 text-[10px] ml-auto">
                        <Images size={8} /> {ev.total_fotos}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPicker(false);
                  if (descPendente) salvarPerfil(descPendente.arr, descPendente.thumb, descPendente.email, 0);
                }}
                className="flex-shrink-0 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition">
                Pular
              </button>
              <button
                onClick={confirmarBusca}
                disabled={selecionados.size === 0}
                className="flex-1 py-3 rounded-xl gradient-primary text-white font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Search size={16} />
                Buscar em {selecionados.size} evento{selecionados.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
