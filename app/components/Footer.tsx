"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar, Images, ScanFace, HelpCircle,
  ShieldCheck, ChevronRight, Lock,
} from "lucide-react";
import { abrirInfoModal } from "./InfoModais";

interface FooterEvento { id: string; nome: string; capa_id?: string; status?: string; folder_id?: string; }
interface SlideItem  { key: string; nome: string; fotoId: string; }

function CarrosselEventos() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [idx, setIdx]       = useState(0);

  useEffect(() => {
    fetch("/api/eventos")
      .then(r => r.ok ? r.json() : [])
      .then((lista: FooterEvento[]) => {
        if (!Array.isArray(lista)) return;
        const ativos = lista.filter(e => e.status !== "encerrado");

        const itens: SlideItem[] = [];

        // 1. Capa escolhida de cada evento (prioridade)
        for (const ev of ativos) {
          if (ev.capa_id) {
            itens.push({ key: `capa-${ev.id}`, nome: ev.nome, fotoId: ev.capa_id });
          }
        }

        // 2. Bônus: 1-2 fotos random de cada evento que tem cache local
        //    (acontece se você já visitou /eventos/[slug] ou /galeria antes)
        try {
          for (const ev of ativos) {
            if (!ev.folder_id) continue;
            const raw = localStorage.getItem(`fotos_${ev.folder_id}`);
            if (!raw) continue;
            const data  = JSON.parse(raw);
            const fotos = Array.isArray(data?.fotos) ? data.fotos as { id: string }[] : [];
            if (!fotos.length) continue;
            // Pega até 2 random por evento, evitando a capa
            const pool = fotos.filter(f => f.id !== ev.capa_id);
            for (let i = 0; i < Math.min(2, pool.length); i++) {
              const r = pool[Math.floor(Math.random() * pool.length)];
              if (r?.id && !itens.some(it => it.fotoId === r.id)) {
                itens.push({ key: `rand-${ev.id}-${r.id}`, nome: ev.nome, fotoId: r.id });
              }
            }
          }
        } catch { /* sem cache local — segue só com capas */ }

        // Embaralha + limita a 10
        itens.sort(() => Math.random() - 0.5);
        const finais = itens.slice(0, 10);
        setSlides(finais);
        // Começa em posição random — F5 sempre vê imagem diferente como "primeira"
        if (finais.length > 0) setIdx(Math.floor(Math.random() * finais.length));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div className="w-full h-full"
        style={{ background: "linear-gradient(135deg,#1A4A80,#2E7DD1)" }} />
    );
  }

  return (
    <>
      {slides.map((s, i) => (
        <img
          key={s.key}
          src={`/api/thumb?id=${s.fotoId}&sz=800`}
          alt={s.nome}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ease-in-out ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* Indicadores (dots) — visíveis só se mais de 1 */}
      {slides.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1 z-10">
          {slides.map((_, i) => (
            <span key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? "bg-white w-4" : "bg-white/40 w-1.5"
              }`} />
          ))}
        </div>
      )}
    </>
  );
}

type LinkItem =
  | { tipo: "link";  href: string;             label: string; icon: typeof Calendar }
  | { tipo: "modal"; modal: "como-funciona" | "privacidade"; label: string; icon: typeof Calendar };

const links: LinkItem[] = [
  { tipo: "link",  href: "/eventos",        label: "Eventos",          icon: Calendar    },
  { tipo: "link",  href: "/minhas-fotos",   label: "Minhas fotos",     icon: Images      },
  { tipo: "link",  href: "/buscar-pessoa",  label: "Buscar por rosto", icon: ScanFace    },
  { tipo: "modal", modal: "como-funciona",  label: "Como funciona",    icon: HelpCircle  },
  { tipo: "modal", modal: "privacidade",    label: "Privacidade",      icon: ShieldCheck },
];

export default function Footer() {
  return (
    <footer
      style={{ background: "linear-gradient(160deg,#061237 0%,#0D2B4E 60%,#1A4A80 100%)" }}
      className="text-white"
    >
      {/* Corpo principal */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">

        {/* ── Col 1: Marca ── */}
        <div className="flex flex-col gap-5">
          <Image
            src="/logos/logo.png"
            alt="Contourline"
            width={160}
            height={44}
            className="brightness-0 invert"
            priority
          />
          <div className="w-10 h-0.5 rounded-full bg-[#2E7DD1]" />
          <div>
            <p className="font-bold text-base text-white leading-tight">
              Galeria de Eventos Contourline
            </p>
            <p className="text-white/60 text-sm mt-1.5 leading-relaxed">
              Suas fotos de eventos organizadas, seguras e fáceis de encontrar.
            </p>
          </div>
          <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <ShieldCheck size={18} className="text-[#5BA4E5] shrink-0 mt-0.5" />
            <p className="text-white/60 text-sm leading-snug">
              Sua foto é usada apenas para localizar suas imagens.
            </p>
          </div>
        </div>

        {/* ── Col 2: Links rápidos ── */}
        <div>
          <p className="text-[#5BA4E5] font-bold text-sm mb-5 tracking-wide uppercase">
            Links rápidos
          </p>
          <ul className="space-y-1.5">
            {links.map((item) => {
              const Icon = item.icon;
              const conteudo = (
                <>
                  <span className="flex items-center gap-3">
                    <Icon size={16} className="text-[#5BA4E5] shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-white/30 group-hover:text-white/60 transition"
                  />
                </>
              );
              const className =
                "w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition group";
              return (
                <li key={item.label}>
                  {item.tipo === "link" ? (
                    <Link href={item.href} className={className}>{conteudo}</Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirInfoModal(item.modal)}
                      className={className}>
                      {conteudo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Col 3: Carrossel de eventos ── */}
        <div className="hidden lg:block relative rounded-2xl overflow-hidden h-64 shadow-xl bg-[#0D2B4E]">
          <CarrosselEventos />
          {/* Overlay escuro pra leitura do texto */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(6,18,55,0.85) 0%, rgba(6,18,55,0.2) 55%, transparent 100%)",
            }}
          />
          {/* Banner na base */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-5 py-4 z-10">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Lock size={16} className="text-white" />
            </div>
            <p className="text-white font-semibold text-sm leading-snug drop-shadow">
              Suas memórias do evento,<br />organizadas com segurança.
            </p>
          </div>
        </div>

        {/* Mobile: banner segurança (substitui col 3) */}
        <div className="lg:hidden flex items-center gap-3 bg-[#1A4A80]/60 border border-white/15 rounded-2xl px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Lock size={16} className="text-white" />
          </div>
          <p className="text-white font-semibold text-sm leading-snug">
            Suas memórias do evento,<br />organizadas com segurança.
          </p>
        </div>
      </div>

      {/* ── Barra inferior ── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-white/40 text-xs">
          <span className="flex items-center gap-2">
            <Lock size={12} />
            Sistema interno para acesso a fotos de eventos.
          </span>
          <span>© {new Date().getFullYear()} Contourline. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  );
}
