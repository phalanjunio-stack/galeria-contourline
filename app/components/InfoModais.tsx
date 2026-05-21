"use client";
import { useEffect, useState } from "react";
import {
  X, HelpCircle, ShieldCheck, ScanFace, Search, Users, Bell,
  Lock, Eye, EyeOff, Cpu,
} from "lucide-react";
import { playSwoosh } from "@/lib/sounds";

type ModalKind = "como-funciona" | "privacidade" | null;

/** Abre uma modal de info via custom event (chame de qualquer client component). */
export function abrirInfoModal(kind: Exclude<ModalKind, null>) {
  window.dispatchEvent(new CustomEvent("info-modal-open", { detail: kind }));
}

export default function InfoModais() {
  const [aberto, setAberto] = useState<ModalKind>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as ModalKind;
      setAberto(detail);
    }
    window.addEventListener("info-modal-open", handler);
    return () => window.removeEventListener("info-modal-open", handler);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setAberto(null); }
    if (aberto) {
      playSwoosh("open");
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      if (aberto) playSwoosh("close");
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setAberto(null)}
    >
      <div
        className="glow-active relative bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setAberto(null)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white hover:bg-gray-100 shadow flex items-center justify-center text-gray-500 hover:text-[#0D2B4E] transition z-10"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {aberto === "como-funciona" && <ComoFuncionaConteudo />}
        {aberto === "privacidade"   && <PrivacidadeConteudo />}
      </div>
    </div>
  );
}

/* ── Conteúdos ─────────────────────────────────────────────── */

function ComoFuncionaConteudo() {
  const passos = [
    { icon: ScanFace, num: 1, titulo: "Cadastre seu rosto",
      texto: "Envie uma selfie nítida. A IA gera uma assinatura facial única (vetor de 128 números) — sua foto não é armazenada como imagem, só esses números." },
    { icon: Search, num: 2, titulo: "Admin indexa os eventos",
      texto: "Após o evento, o admin processa todas as fotos no sistema. A IA detecta cada rosto e gera a mesma assinatura facial pra cada pessoa." },
    { icon: Users, num: 3, titulo: "Sistema encontra você",
      texto: "Sua assinatura é comparada com as dos rostos nas fotos. Quando dá match, você recebe uma notificação no sininho do site." },
    { icon: Bell, num: 4, titulo: "Veja suas fotos",
      texto: "Acesse 'Minhas fotos' no menu ou pelo banner 'Encontramos você'. Confirme quais são realmente suas, baixe, favorite ou compartilhe." },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow">
          <HelpCircle size={22} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-[#0D2B4E]">Como funciona</h2>
      </div>

      <p className="text-gray-500 text-sm mb-6 leading-relaxed">
        Encontre você nas fotos de eventos automaticamente com reconhecimento facial.
        Tudo é processado de forma privada e segura.
      </p>

      <div className="space-y-3">
        {passos.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.num} className="flex gap-4 items-start bg-[#F5F7FA] rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow">
                <Icon size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0D2B4E] flex items-center gap-2 mb-1">
                  <span className="text-[#2E7DD1] text-sm font-black">{p.num}.</span>
                  {p.titulo}
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">{p.texto}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-start gap-3">
        <Cpu size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-emerald-800 text-sm leading-relaxed">
          <strong>Análise local.</strong> Sua selfie é processada 100% no seu navegador
          (TensorFlow.js + face-api). A imagem nunca é enviada pra um servidor externo.
        </p>
      </div>
    </div>
  );
}

function PrivacidadeConteudo() {
  const itens = [
    { icon: Lock, titulo: "Sua selfie é analisada localmente",
      texto: "A selfie que você envia pra cadastrar seu rosto é processada exclusivamente pelo seu navegador. Essa imagem nunca trafega pela rede nem é salva nos nossos servidores." },
    { icon: EyeOff, titulo: "Não armazenamos sua selfie",
      texto: "Da sua selfie, guardamos apenas uma 'assinatura facial' — um vetor numérico de 128 dimensões. Não dá pra reconstruir a foto original a partir desses números. (As fotos dos eventos continuam normalmente na galeria — esse item se refere SÓ à selfie de busca.)" },
    { icon: Eye, titulo: "Visibilidade restrita",
      texto: "Apenas você vê suas fotos confirmadas em 'Minhas fotos'. Nenhum outro usuário consegue listar em quais eventos você aparece." },
    { icon: ScanFace, titulo: "Remoção a qualquer momento",
      texto: "Em 'Perfil → Remover meu rosto cadastrado' você apaga sua assinatura facial. Buscas futuras param de te encontrar e você não recebe mais notificações automáticas." },
  ];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow"
          style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
          <ShieldCheck size={22} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-[#0D2B4E]">Privacidade</h2>
      </div>

      <p className="text-gray-500 text-sm mb-6 leading-relaxed">
        Levamos seus dados a sério. Nossa arquitetura foi pensada pra você manter o controle.
      </p>

      <div className="space-y-3">
        {itens.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.titulo} className="flex gap-4 items-start bg-[#F5F7FA] rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                <Icon size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0D2B4E] mb-1">{p.titulo}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{p.texto}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-gray-400 text-xs mt-6 text-center">
        Dúvidas sobre privacidade? Entre em contato com a equipe Contourline.
      </p>
    </div>
  );
}
