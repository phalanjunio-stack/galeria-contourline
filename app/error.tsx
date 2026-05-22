"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EFF5FF] px-4">
      <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle size={30} />
        </div>
        <h1 className="text-2xl font-black text-[#0D2B4E]">Esta pagina nao carregou</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Tivemos uma falha ao abrir esta tela. Tente novamente; se persistir, confira o deploy e os servicos em Admin Sistema.
        </p>
        {error?.digest && <p className="mt-3 text-xs text-gray-300">Codigo: {error.digest}</p>}
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2167AE] py-3 text-sm font-bold text-white">
            <RefreshCw size={15} /> Tentar novamente
          </button>
          <Link href="/" className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 py-3 text-sm font-bold text-[#1A4A80]">
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
