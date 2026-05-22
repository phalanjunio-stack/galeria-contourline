import Link from "next/link";
import { Camera } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada — Galeria Contourline",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1A4A80] to-[#2E7DD1] flex items-center justify-center shadow-lg">
        <Camera size={36} className="text-white" />
      </div>
      <div>
        <h1 className="text-5xl font-black text-[#0D2B4E] mb-2">404</h1>
        <p className="text-lg font-semibold text-[#1A4A80] mb-1">Página não encontrada</p>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          O endereço que você tentou acessar não existe ou foi removido.
        </p>
      </div>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1A4A80] to-[#2E7DD1] text-white font-semibold text-sm shadow hover:opacity-90 transition"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
