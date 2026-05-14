"use client";
import { useState, useRef } from "react";
import { Upload, Search, Shield, X, CheckCircle } from "lucide-react";

export default function BuscarPessoaPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow">
          <Search size={32} className="text-white" />
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0D2B4E] mb-2">Buscar por reconhecimento facial</h1>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Envie uma foto de referência e encontramos todas as fotos dessa pessoa nos eventos.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
        {!preview ? (
          <label
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-[#2E7DD1]/40 rounded-2xl p-12 cursor-pointer hover:border-[#2E7DD1] hover:bg-[#EFF5FF] transition group"
          >
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow group-hover:scale-105 transition">
              <Upload size={28} className="text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#0D2B4E] text-sm">Selecionar foto de referência</p>
              <p className="text-gray-400 text-xs mt-1">Envie uma foto nítida do rosto da pessoa</p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-[#2E7DD1] shadow-lg">
                <img src={preview} alt="Referência" className="w-full h-full object-cover" />
              </div>
              <button onClick={() => setPreview(null)}
                className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow hover:bg-red-600 transition">
                <X size={14} className="text-white" />
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-[#0D2B4E] font-semibold">
              <CheckCircle size={15} className="text-emerald-500" /> Foto de referência carregada
            </p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 bg-[#EFF5FF] rounded-xl px-4 py-3 mb-6 border border-[#2E7DD1]/15">
        <Shield size={16} className="text-[#2E7DD1] mt-0.5 shrink-0" />
        <p className="text-[#1A4A80] text-xs leading-relaxed">
          <span className="font-semibold">Uso responsável.</span> Esta função foi liberada pelo administrador para este evento. As imagens encontradas são de uso exclusivo dos participantes.
        </p>
      </div>

      <button
        disabled={!preview}
        className="w-full py-4 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Search size={18} /> Buscar pessoa
      </button>
    </div>
  );
}
