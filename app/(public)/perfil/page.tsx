"use client";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  User, Mail, Bell, LogOut, CheckCircle, Shield, Trash2,
  Loader2, Camera, Scan, Upload, X, RefreshCw, Images, Heart, CalendarDays,
} from "lucide-react";
import { useToast } from "@/app/components/ToastProvider";
import { fetchMinhasFotos, ouvirAtualizacoes, adicionarDescriptor, lerDescriptors, menorDistancia, invalidarMinhasFotos } from "@/lib/minhasFotos";
import { lerFavoritos } from "@/app/(public)/favoritos/page";

interface Perfil {
  email: string; nome: string; foto: string;
  foto_perfil?: string; foto_rastreio?: string;
  descriptor?: number[];
  notificar_site: boolean;
  criado_em: string; atualizado_em: string;
}

async function resizeBase64(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const s = Math.min(img.width, img.height);
      const ox = (img.width  - s) / 2;
      const oy = (img.height - s) / 2;
      ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = dataUrl;
  });
}

export default function PerfilPage() {
  const { data: session, status } = useSession();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const { toast }     = useToast();

  const [perfil,     setPerfil]     = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [salvoOk,    setSalvoOk]    = useState(false);
  const [notifSite,  setNotifSite]  = useState(true);

  // Stats agregados (eventos, fotos confirmadas, favoritas)
  const [stats, setStats] = useState<{ eventos: number; fotos: number; favoritas: number }>({ eventos: 0, fotos: 0, favoritas: 0 });

  // Foto de perfil
  const [fotoPerfil,      setFotoPerfil]      = useState<string | null>(null);
  const [uploadingPerfil, setUploadingPerfil] = useState(false);
  const inputPerfilRef = useRef<HTMLInputElement>(null);

  // Foto rastreio
  const [fotoRastreio,  setFotoRastreio]  = useState<string | null>(null);
  const [thumbRastreio, setThumbRastreio] = useState<string | null>(null);
  const [detectando,    setDetectando]    = useState(false);
  const [rastreioOk,    setRastreioOk]    = useState(false);
  const [rastreioErro,  setRastreioErro]  = useState("");
  const [modoAdicionar, setModoAdicionar] = useState(false);   // se true, append; senão substitui
  const [rastreios,     setRastreios]     = useState<string[]>([]); // todas as selfies do perfil
  const inputRastreioRef = useRef<HTMLInputElement>(null);

  // Usuário simples
  const [usuarioSimples, setUsuarioSimples] = useState<{ nome: string; email: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("usuario_simples");
      if (raw) setUsuarioSimples(JSON.parse(raw));
    } catch {}
  }, []);

  // Banner de boas-vindas ao vir do cadastro-rosto
  const [mostrarBanner, setMostrarBanner] = useState(false);
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setMostrarBanner(true);
      // Remove o param da URL sem recarregar
      router.replace("/perfil", { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logado       = !!session?.user || !!usuarioSimples;
  const nomeExibido  = session?.user?.name  ?? usuarioSimples?.nome  ?? "";
  const emailExibido = session?.user?.email ?? usuarioSimples?.email ?? "";
  const inicial      = nomeExibido?.[0]?.toUpperCase() ?? "?";
  const avatarSrc    = fotoPerfil ?? (session?.user?.image || null);

  function bodyComIdent(extra: Record<string, unknown> = {}) {
    if (session) return extra;
    return { ...extra, email_simples: usuarioSimples?.email, nome_simples: usuarioSimples?.nome };
  }

  // Carrega stats (eventos onde aparece + fotos confirmadas + favoritas)
  useEffect(() => {
    const email = session?.user?.email ?? usuarioSimples?.email;
    if (!email) return;
    async function recarregar() {
      const fresh = await fetchMinhasFotos(email!);
      const favs  = lerFavoritos();
      setStats({
        eventos:   fresh?.porEvento.length ?? 0,
        fotos:     fresh?.matches.length ?? 0,
        favoritas: favs.length,
      });
    }
    recarregar();
    return ouvirAtualizacoes(recarregar);
  }, [session, usuarioSimples]);

  useEffect(() => {
    if (status === "loading") return;
    async function carregar() {
      try {
        let url = "/api/perfil";
        if (!session && usuarioSimples?.email)
          url = `/api/perfil?email=${encodeURIComponent(usuarioSimples.email)}`;
        if (!session && !usuarioSimples) { setCarregando(false); return; }

        const d: Perfil | null = await fetch(url).then(r => r.ok ? r.json() : null);
        // Sempre lê localStorage como base (funciona offline e para usuário simples)
        const localFotoPerfil  = localStorage.getItem("foto_perfil_thumb");
        const localFotoRastreio = localStorage.getItem("foto_rastreio_thumb");
        if (localFotoPerfil)   setFotoPerfil(localFotoPerfil);
        if (localFotoRastreio) setThumbRastreio(localFotoRastreio);

        if (d) {
          setPerfil(d);
          setNotifSite(d.notificar_site);
          // Servidor tem prioridade sobre localStorage
          if (d.foto_perfil)   { setFotoPerfil(d.foto_perfil);   localStorage.setItem("foto_perfil_thumb",   d.foto_perfil); }
          if (d.foto_rastreio) { setThumbRastreio(d.foto_rastreio); localStorage.setItem("foto_rastreio_thumb", d.foto_rastreio); }
          // Lista completa de selfies (multi-selfie)
          const dAny = d as unknown as { foto_rastreios?: string[] };
          if (Array.isArray(dAny.foto_rastreios) && dAny.foto_rastreios.length > 0) {
            setRastreios(dAny.foto_rastreios);
          } else if (d.foto_rastreio) {
            setRastreios([d.foto_rastreio]);
          }
        }
      } catch {
        const localThumb = localStorage.getItem("foto_rastreio_thumb");
        if (localThumb) setThumbRastreio(localThumb);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, usuarioSimples?.email]);

  // ── Upload foto de perfil — auto-save + toast ──────────────
  async function handleFotoPerfil(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPerfil(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const small  = await resizeBase64(base64, 200);
      setFotoPerfil(small);
      localStorage.setItem("foto_perfil_thumb", small);
      const res = await fetch("/api/perfil", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyComIdent({ foto_perfil: small })),
      }).catch(() => null);

      setUploadingPerfil(false);

      // Dispara evento para Topbar atualizar imediatamente
      window.dispatchEvent(new Event("profile-updated"));

      if (res?.ok) {
        toast({ tipo: "sucesso", titulo: "Foto de perfil salva!", duracao: 3500 });
      } else {
        toast({ tipo: "info", titulo: "Foto salva no dispositivo.", mensagem: "Sincroniza quando o servidor estiver disponível.", duracao: 4000 });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Upload + detecção foto rastreio ───────────────────────
  function handleFotoRastreioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoRastreio(ev.target?.result as string);
    reader.readAsDataURL(file);
    setRastreioOk(false); setRastreioErro("");
    e.target.value = "";
  }

  async function detectarRosto() {
    if (!fotoRastreio) return;
    setDetectando(true); setRastreioErro("");
    try {
      const faceapi = await import("face-api.js");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      const img = await faceapi.fetchImage(fotoRastreio);
      const det = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
        .withFaceLandmarks(true).withFaceDescriptor();

      if (!det) {
        setRastreioErro("Nenhum rosto detectado. Tente outra foto.");
        setDetectando(false);
        return;
      }

      const descriptor = Array.from(det.descriptor);
      const thumb = await resizeBase64(fotoRastreio, 120);

      // ★ LÓGICA INTELIGENTE DO "TROCAR SELFIE" ★
      // Por padrão, "Trocar selfie" ADICIONA (mesma pessoa só mudou ângulo/luz).
      // Só substitui+limpa se for OUTRA PESSOA (distância > 0.70) E user confirmar.
      let acaoFinal: "add" | "replace" | "replace_clean" = modoAdicionar ? "add" : "add";
      if (!modoAdicionar) {
        const anteriores = lerDescriptors();
        if (anteriores.length > 0) {
          const dist = menorDistancia(anteriores, descriptor);
          if (dist > 0.70) {
            // Provavelmente outra pessoa
            const confirma = window.confirm(
              `🤔 Esse rosto parece BEM diferente do cadastrado (distância ${dist.toFixed(2)}).\n\n` +
              `É outra pessoa usando o mesmo perfil?\n\n` +
              `OK = SIM, é outra pessoa → limpar tudo (fotos confirmadas, selfies) e começar do zero\n` +
              `Cancelar = mesma pessoa (mudou bastante mas sou eu) → só adicionar como nova selfie`
            );
            acaoFinal = confirma ? "replace_clean" : "add";
          } else if (dist > 0.55) {
            // Provavelmente mesma pessoa, mas mudou bastante
            // (cabelo, óculos, maquiagem). Adiciona como mais uma selfie.
            acaoFinal = "add";
          } else {
            // Muito próximo do anterior — adiciona pra ter mais variação
            acaoFinal = "add";
          }
        } else {
          // Sem anteriores → primeira selfie, salva normal
          acaoFinal = "replace";
        }
      }

      // Se for limpar, faz primeiro
      if (acaoFinal === "replace_clean") {
        const emailAtual = session?.user?.email ?? usuarioSimples?.email;
        if (emailAtual) {
          await fetch(`/api/meu/fotos?email=${encodeURIComponent(emailAtual)}`, { method: "DELETE" }).catch(() => {});
          invalidarMinhasFotos(emailAtual);
        }
        setStats({ eventos: 0, fotos: 0, favoritas: stats.favoritas });
        setRastreios([]);
        // Limpa descriptors locais também
        try {
          sessionStorage.removeItem("faceDescriptor");
          sessionStorage.removeItem("faceDescriptors");
          localStorage.removeItem("face_descriptor_v1");
          localStorage.removeItem("face_descriptors_v1");
        } catch {}
      }

      // Body conforme ação
      const body: Record<string, unknown> = (acaoFinal === "add" && lerDescriptors().length > 0)
        ? { descriptors_add: [descriptor], foto_rastreio: thumb }
        : { descriptor, foto_rastreio: thumb };

      const res = await fetch("/api/perfil", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyComIdent(body)),
      }).catch(() => null);

      if (acaoFinal === "add") {
        // Append no estado local
        adicionarDescriptor(descriptor);
        setRastreios(prev => [...prev, thumb].slice(0, 5));
        if (modoAdicionar) setModoAdicionar(false);
      } else {
        // Substituição completa (replace ou replace_clean)
        sessionStorage.setItem("faceDescriptor", JSON.stringify(descriptor));
        sessionStorage.setItem("faceDescriptors", JSON.stringify([descriptor]));
        localStorage.setItem("face_descriptor_v1",  JSON.stringify(descriptor));
        localStorage.setItem("face_descriptors_v1", JSON.stringify([descriptor]));
        localStorage.setItem("foto_rastreio_thumb", thumb);
        setThumbRastreio(thumb);
        setRastreios([thumb]);
      }
      setFotoRastreio(null);
      setRastreioOk(true);

      if (res?.ok) {
        const titulos = {
          add: "Mais uma selfie cadastrada!",
          replace: "Selfie de rastreio salva!",
          replace_clean: "Perfil resetado, novo rosto cadastrado",
        };
        const mensagens = {
          add: "Adicionei à galeria — quanto mais selfies, melhor a IA encontra você.",
          replace: "Usaremos para encontrar você nos eventos.",
          replace_clean: "Fotos confirmadas anteriores foram limpas. Começando do zero!",
        };
        toast({
          tipo: "sucesso",
          titulo:  titulos[acaoFinal],
          mensagem: mensagens[acaoFinal],
          duracao: 4500,
        });
      }
    } catch {
      setRastreioErro("Erro ao processar. Tente novamente.");
    }
    setDetectando(false);
  }

  // ── Salvar preferências ───────────────────────────────────
  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/perfil", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyComIdent({ notificar_site: notifSite })),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) {
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 2500);
      toast({ tipo: "sucesso", titulo: "Preferências salvas!", duracao: 3000 });
    }
  }

  function sair() {
    if (session) { signOut({ callbackUrl: "/" }); }
    else {
      localStorage.removeItem("usuario_simples");
      sessionStorage.removeItem("faceDescriptor");
      router.push("/");
    }
  }

  if (status === "loading" || carregando) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-[#2E7DD1]" />
    </div>
  );

  if (!logado) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg">
        <User size={36} className="text-white" />
      </div>
      <h1 className="text-2xl font-black text-[#0D2B4E] mb-2">Meu Perfil</h1>
      <p className="text-gray-400 text-sm mb-8">Entre para gerenciar seu perfil e rastreio facial.</p>
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-6">
        <Link href="/cadastrar-rosto"
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
          <Scan size={15} /> Cadastrar com rosto
        </Link>
        <p className="text-gray-400 text-xs text-center mt-3">
          Use seu rosto + email para encontrar suas fotos.
        </p>
      </div>
    </div>
  );

  const temDescriptor = !!(perfil?.descriptor?.length ||
    (typeof window !== "undefined" && sessionStorage.getItem("faceDescriptor")));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

      {/* ── BANNER: veio do cadastro-rosto ── */}
      {mostrarBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-emerald-800 font-bold text-sm">Rosto cadastrado com sucesso!</p>
            <p className="text-emerald-600 text-xs mt-0.5">
              Adicione uma foto de perfil abaixo e depois veja suas fotos encontradas.
            </p>
          </div>
          <button onClick={() => setMostrarBanner(false)} className="text-emerald-400 hover:text-emerald-600 shrink-0">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── STATS (sempre visível pra usuário identificado) ── */}
      {(stats.eventos > 0 || stats.fotos > 0 || stats.favoritas > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <Link href="/minhas-fotos"
            className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md hover:border-[#2E7DD1]/40 transition group">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#EFF5FF] flex items-center justify-center group-hover:scale-110 transition">
              <Images size={18} className="text-[#2E7DD1]" />
            </div>
            <p className="text-2xl font-black text-[#0D2B4E]">{stats.fotos}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mt-0.5">
              Foto{stats.fotos !== 1 ? "s" : ""}
            </p>
          </Link>
          <Link href="/eventos"
            className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md hover:border-[#2E7DD1]/40 transition group">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-110 transition">
              <CalendarDays size={18} className="text-purple-600" />
            </div>
            <p className="text-2xl font-black text-[#0D2B4E]">{stats.eventos}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mt-0.5">
              Evento{stats.eventos !== 1 ? "s" : ""}
            </p>
          </Link>
          <Link href="/favoritos"
            className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md hover:border-red-300 transition group">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-50 flex items-center justify-center group-hover:scale-110 transition">
              <Heart size={18} className="text-red-500" fill="currentColor" />
            </div>
            <p className="text-2xl font-black text-[#0D2B4E]">{stats.favoritas}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mt-0.5">
              Favorita{stats.favoritas !== 1 ? "s" : ""}
            </p>
          </Link>
        </div>
      )}

      {/* ── VER FOTOS (quando tem rosto cadastrado) ── */}
      {temDescriptor && (
        <Link href="/resultado"
          className="flex items-center gap-3 rounded-2xl px-5 py-4 border border-[#2E7DD1]/25 shadow-sm hover:shadow-md transition group"
          style={{ background: "linear-gradient(135deg,#EFF5FF,#E4EFFE)" }}>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow shrink-0">
            <Images size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#0D2B4E] text-sm">Ver minhas fotos</p>
            <p className="text-gray-400 text-xs mt-0.5">Nossa IA já encontrou você nos eventos</p>
          </div>
          <div className="text-[#2E7DD1] group-hover:translate-x-1 transition-transform">→</div>
        </Link>
      )}

      {/* ── CARD DO USUÁRIO ── */}
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-6">
        <div className="flex items-center gap-5">

          {/* Avatar clicável */}
          <div className="relative shrink-0 cursor-pointer group" onClick={() => inputPerfilRef.current?.click()}>
            {uploadingPerfil ? (
              <div className="w-20 h-20 rounded-2xl bg-[#EFF5FF] flex items-center justify-center">
                <Loader2 size={24} className="text-[#2E7DD1] animate-spin" />
              </div>
            ) : avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-20 h-20 rounded-2xl object-cover shadow border-2 border-white" />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow"
                style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }}>
                {inicial}
              </div>
            )}
            {!uploadingPerfil && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                style={{ background: "rgba(0,0,0,0.45)" }}>
                <Camera size={20} className="text-white" />
              </div>
            )}
            <input ref={inputPerfilRef} type="file" accept="image/*" className="hidden" onChange={handleFotoPerfil} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-[#0D2B4E] truncate">{nomeExibido || "Usuário"}</h2>
            <p className="text-gray-400 text-sm flex items-center gap-1.5 mt-0.5 truncate">
              <Mail size={13} /> {emailExibido}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {session ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle size={11} /> Conta Google
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2E7DD1] border border-blue-100">
                  <User size={11} /> Cadastro simples
                </span>
              )}
              <button
                onClick={() => inputPerfilRef.current?.click()}
                disabled={uploadingPerfil}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 hover:text-[#2E7DD1] hover:bg-[#EFF5FF] transition border border-gray-100 disabled:opacity-40">
                <Camera size={11} /> {uploadingPerfil ? "Salvando..." : "Trocar foto"}
              </button>
            </div>
          </div>
        </div>

        {/* Dica de foto */}
        {!avatarSrc && (
          <button
            onClick={() => inputPerfilRef.current?.click()}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#2E7DD1]/30 text-[#2E7DD1] text-sm font-semibold hover:bg-[#EFF5FF] transition">
            <Camera size={15} /> Adicionar foto de perfil
          </button>
        )}
      </div>

      {/* ── FOTO DE RASTREIO FACIAL ── */}
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D2B4E] mb-1 flex items-center gap-2">
          <Scan size={16} className="text-[#2E7DD1]" /> Fotos para rastreio automático
        </h3>
        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
          Use selfies nítidas com rosto de frente. <strong className="text-[#2E7DD1]">Cadastre mais de uma</strong> (ângulos/iluminações diferentes) pra IA encontrar você melhor.
        </p>

        {/* Galeria de selfies cadastradas */}
        {rastreios.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-5 p-3 bg-[#F5F7FA] rounded-2xl border border-gray-100">
            {rastreios.map((thumb, i) => (
              <div key={i} className="relative">
                <img src={thumb} alt={`Selfie ${i + 1}`}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-[#2E7DD1]/30" />
                <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[#2E7DD1] text-white text-[10px] font-black flex items-center justify-center shadow">
                  {i + 1}
                </span>
              </div>
            ))}
            {rastreios.length < 5 && temDescriptor && !fotoRastreio && (
              <button
                onClick={() => { setModoAdicionar(true); inputRastreioRef.current?.click(); }}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-[#2E7DD1]/40 text-[#2E7DD1] hover:bg-[#EFF5FF] transition flex flex-col items-center justify-center gap-0.5">
                <Upload size={16} />
                <span className="text-[9px] font-bold">+ Selfie</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-4">
          {/* Thumb atual */}
          <div className="shrink-0">
            {thumbRastreio ? (
              <div className="relative">
                <img src={thumbRastreio} alt="Foto rastreio"
                  className="w-20 h-20 rounded-2xl object-cover border-2 shadow"
                  style={{ borderColor: rastreioOk ? "#10b981" : "#2E7DD1" }} />
                {rastreioOk && (
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50">
                <User size={28} className="text-gray-300" />
              </div>
            )}
          </div>

          {/* Área de upload / detecção */}
          <div className="flex-1">
            {fotoRastreio ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-full rounded-2xl overflow-hidden" style={{ maxWidth: 200 }}>
                  <img src={fotoRastreio} alt="Nova foto" className="w-full rounded-2xl object-cover aspect-square" />
                  <button onClick={() => { setFotoRastreio(null); setRastreioErro(""); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                    <X size={12} className="text-white" />
                  </button>
                </div>
                {rastreioErro && <p className="text-red-500 text-xs">{rastreioErro}</p>}
                <button onClick={detectarRosto} disabled={detectando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#2E7DD1,#1A4A80)" }}>
                  {detectando
                    ? <><Loader2 size={15} className="animate-spin" /> Detectando rosto...</>
                    : <><Scan size={15} /> Confirmar esta foto</>}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rastreioOk && (
                  <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1.5 mb-1">
                    <CheckCircle size={13} /> Rosto atualizado com sucesso!
                  </p>
                )}
                {temDescriptor && !rastreioOk && (
                  <p className="text-gray-400 text-xs mb-1">Rosto cadastrado. Clique para atualizar.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setModoAdicionar(false); inputRastreioRef.current?.click(); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border-2"
                    style={temDescriptor
                      ? { borderColor: "#d1d5db", color: "#6b7280", background: "#f9fafb" }
                      : { borderColor: "#2E7DD1", color: "#2E7DD1", background: "#EFF5FF" }}>
                    {temDescriptor
                      ? <><RefreshCw size={14} /> Trocar selfie</>
                      : <><Upload size={14} /> Enviar selfie</>}
                  </button>
                  {temDescriptor && rastreios.length < 5 && rastreios.length <= 1 && (
                    <button onClick={() => { setModoAdicionar(true); inputRastreioRef.current?.click(); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border-2 border-[#2E7DD1] text-[#2E7DD1] hover:bg-[#EFF5FF]">
                      <Upload size={14} /> + Adicionar selfie
                    </button>
                  )}
                </div>
                {!temDescriptor && (
                  <p className="text-gray-300 text-xs">JPG ou PNG · Rosto de frente e bem iluminado</p>
                )}
                {temDescriptor && rastreios.length === 1 && (
                  <p className="text-[#2E7DD1] text-xs">💡 <strong>Dica:</strong> adicione 2-3 selfies com ângulos diferentes pra IA achar você melhor.</p>
                )}
                <input ref={inputRastreioRef} type="file" accept="image/*" className="hidden" onChange={handleFotoRastreioFile} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── NOTIFICAÇÕES ── */}
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-6">
          <h3 className="font-bold text-[#0D2B4E] mb-4 flex items-center gap-2">
            <Bell size={16} className="text-[#2E7DD1]" /> Notificações
          </h3>
          <label className="flex items-center gap-3 cursor-pointer group mb-5">
            <div onClick={() => setNotifSite(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifSite ? "bg-[#2E7DD1]" : "bg-gray-200"}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifSite ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Bell size={13} className="text-[#2E7DD1]" /> Notificações no site quando aparecer em fotos
            </span>
          </label>
          <button onClick={salvar} disabled={salvando}
            className="w-full py-3 rounded-2xl gradient-primary text-white font-bold text-sm shadow transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {salvando
              ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
              : salvoOk
              ? <><CheckCircle size={15} /> Salvo!</>
              : "Salvar preferências"}
          </button>
        </div>

      {/* ── PRIVACIDADE ── */}
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D2B4E] mb-3 flex items-center gap-2">
          <Shield size={16} className="text-[#2E7DD1]" /> Privacidade
        </h3>
        <p className="text-gray-400 text-xs leading-relaxed mb-4">
          Seu rosto é processado localmente no dispositivo. Nenhuma imagem é enviada para servidores externos.
          O vetor facial armazenado não pode ser revertido para reconstruir sua foto.
        </p>
        {temDescriptor && (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => {
              sessionStorage.removeItem("faceDescriptor");
              sessionStorage.removeItem("faceDescriptors");
              localStorage.removeItem("face_descriptor_v1");
              localStorage.removeItem("face_descriptors_v1");
              localStorage.removeItem("foto_rastreio_thumb");
              setThumbRastreio(null);
              setRastreioOk(false);
              setRastreios([]);
              setPerfil(p => p ? { ...p, descriptor: undefined, foto_rastreio: undefined } : p);
              fetch("/api/perfil", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyComIdent({ descriptor: null, foto_rastreio: null })),
              }).catch(() => {});
              toast({ tipo: "info", titulo: "Rosto removido.", duracao: 3000 });
            }} className="flex items-center gap-2 text-red-400 hover:text-red-600 text-sm font-semibold transition">
              <Trash2 size={14} /> Remover meu rosto cadastrado
            </button>

            <button onClick={async () => {
              const confirma = window.confirm(
                "🔄 Recomeçar perfil do zero?\n\n" +
                "Vai apagar TUDO desse perfil:\n" +
                "• Suas selfies cadastradas\n" +
                "• Fotos confirmadas em 'Minhas fotos'\n" +
                "• Histórico do reconhecimento\n\n" +
                "Útil quando outra pessoa vai usar esse dispositivo/email.\n\n" +
                "Tem certeza?"
              );
              if (!confirma) return;
              const emailAtual = session?.user?.email ?? usuarioSimples?.email;
              // 1. Limpa Drive _mf_{email}.json
              if (emailAtual) {
                await fetch(`/api/meu/fotos?email=${encodeURIComponent(emailAtual)}`, { method: "DELETE" }).catch(() => {});
              }
              // 2. Limpa rosto no perfil server
              await fetch("/api/perfil", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyComIdent({ descriptor: null, foto_rastreio: null })),
              }).catch(() => {});
              // 3. Limpa tudo local
              try {
                sessionStorage.removeItem("faceDescriptor");
                sessionStorage.removeItem("faceDescriptors");
                localStorage.removeItem("face_descriptor_v1");
                localStorage.removeItem("face_descriptors_v1");
                localStorage.removeItem("foto_rastreio_thumb");
                localStorage.removeItem("foto_perfil_thumb");
              } catch {}
              if (emailAtual) invalidarMinhasFotos(emailAtual);
              // 4. Reseta estado da UI
              setThumbRastreio(null);
              setRastreios([]);
              setFotoPerfil(null);
              setRastreioOk(false);
              setPerfil(p => p ? { ...p, descriptor: undefined, foto_rastreio: undefined } : p);
              setStats({ eventos: 0, fotos: 0, favoritas: stats.favoritas });
              toast({
                tipo: "sucesso",
                titulo: "Perfil resetado!",
                mensagem: "Tudo limpo. Próxima pessoa pode cadastrar o rosto dela em /cadastrar-rosto.",
                duracao: 5500,
              });
            }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 text-sm font-bold transition">
              <RefreshCw size={14} /> Recomeçar perfil
            </button>
          </div>
        )}
      </div>

      {/* ── SAIR ── */}
      <div className="bg-white rounded-3xl shadow border border-gray-100 p-4">
        <button onClick={sair}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-red-500 font-bold text-sm hover:bg-red-50 transition">
          <LogOut size={16} /> Sair da conta
        </button>
      </div>

    </div>
  );
}
