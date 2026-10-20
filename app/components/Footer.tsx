"use client";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ScanFace } from "lucide-react";
import { abrirInfoModal } from "./InfoModais";

type LinkItem =
  | { tipo: "link";  href: string; label: string }
  | { tipo: "modal"; modal: "como-funciona" | "privacidade"; label: string };

const navegar: LinkItem[] = [
  { tipo: "link", href: "/eventos",       label: "Eventos" },
  { tipo: "link", href: "/minhas-fotos",  label: "Minhas fotos" },
  { tipo: "link", href: "/buscar-pessoa", label: "Buscar por rosto" },
];

const ajuda: LinkItem[] = [
  { tipo: "modal", modal: "como-funciona", label: "Como funciona" },
  { tipo: "modal", modal: "privacidade",   label: "Privacidade" },
  { tipo: "link",  href: "/cadastrar-rosto", label: "Cadastrar rosto" },
];

function ListaLinks({ titulo, itens }: { titulo: string; itens: LinkItem[] }) {
  const cls = "text-sm text-white/65 transition-colors hover:text-white";
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">{titulo}</p>
      <ul className="space-y-2.5">
        {itens.map((item) => (
          <li key={item.label}>
            {item.tipo === "link"
              ? <Link href={item.href} className={cls}>{item.label}</Link>
              : <button type="button" onClick={() => abrirInfoModal(item.modal)} className={cls}>{item.label}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-[#06142A] text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 lg:grid-cols-[1.6fr_1fr_1fr_1.4fr] lg:px-8">
        <div className="col-span-2 lg:col-span-1">
          <Image src="/logos/logo.png" alt="Contourline" width={150} height={40} className="brightness-0 invert" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            A galeria de fotos dos eventos Contourline. Encontre-se nas fotos com reconhecimento facial.
          </p>
        </div>

        <ListaLinks titulo="Navegar" itens={navegar} />
        <ListaLinks titulo="Ajuda" itens={ajuda} />

        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:col-span-1">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-[#7DB9F0]" /> Sua privacidade
          </p>
          <p className="mb-4 text-sm leading-relaxed text-white/55">
            Sua selfie é usada apenas para localizar suas imagens nos eventos.
          </p>
          <Link href="/cadastrar-rosto" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7DB9F0] hover:text-white">
            <ScanFace size={15} /> Encontrar minhas fotos
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/35 sm:flex-row lg:px-8">
          <span>Sistema interno para acesso a fotos de eventos.</span>
          <span>© {new Date().getFullYear()} Contourline. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  );
}
