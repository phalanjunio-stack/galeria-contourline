"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg">
          <AlertTriangle size={36} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#0D2B4E] mb-2">
          Algo deu errado
        </h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Encontramos um problema ao carregar essa parte do site. Pode ter sido uma conexão lenta ou um deploy em andamento.
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-400 font-mono mb-6">
            ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-br from-[#2E7DD1] to-[#7a3cff] text-white font-bold text-sm shadow-lg hover:opacity-90 transition"
          >
            <RotateCcw size={15} /> Tentar de novo
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-gray-200 text-[#0D2B4E] font-bold text-sm hover:bg-gray-50 transition"
          >
            <Home size={15} /> Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
