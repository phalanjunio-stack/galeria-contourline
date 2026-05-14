"use client";
import type { ReactElement } from "react";
import { HardDrive, FolderOpen, RefreshCw, CheckCircle, AlertCircle, Clock, Plus } from "lucide-react";

const pastas = [
  { nome: "Confraterização 2024",  fotos: 320, status: "sincronizado", ultima: "há 10 min" },
  { nome: "Workshop Inovação",      fotos: 215, status: "sincronizado", ultima: "há 1 hora"  },
  { nome: "Feira de Negócios",      fotos: 278, status: "processando",  ultima: "agora"      },
  { nome: "Palestra Liderança",     fotos: 189, status: "sincronizado", ultima: "ontem"       },
];

const statusIcon: Record<string, ReactElement> = {
  sincronizado: <CheckCircle size={15} className="text-emerald-500" />,
  processando:  <RefreshCw   size={15} className="text-amber-500 animate-spin" />,
  erro:         <AlertCircle size={15} className="text-red-500" />,
};
const statusLabel: Record<string, string> = {
  sincronizado: "text-emerald-600 bg-emerald-50",
  processando:  "text-amber-600 bg-amber-50",
  erro:         "text-red-600 bg-red-50",
};

export default function DrivePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
            <HardDrive className="text-[#2E7DD1]" size={24} /> Google Drive
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Sincronize pastas do Drive com os eventos da galeria</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition">
          <Plus size={15} /> Conectar pasta
        </button>
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0D2B4E]">3</p>
              <p className="text-xs text-gray-500">Sincronizadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <RefreshCw size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0D2B4E]">1</p>
              <p className="text-xs text-gray-500">Processando</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow">
              <HardDrive size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0D2B4E]">1.002</p>
              <p className="text-xs text-gray-500">Fotos no Drive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pastas conectadas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-bold text-[#0D2B4E] mb-5">Pastas conectadas</h2>
        <div className="space-y-3">
          {pastas.map((p) => (
            <div key={p.nome} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-[#EFF5FF] transition">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow">
                <FolderOpen size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0D2B4E] text-sm truncate">{p.nome}</p>
                <p className="text-gray-400 text-xs flex items-center gap-1">
                  <Clock size={11} /> Última sync: {p.ultima} · {p.fotos} fotos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusLabel[p.status]}`}>
                  {statusIcon[p.status]} {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
                <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-[#EFF5FF] transition text-[#2E7DD1]">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conectar nova pasta */}
      <div className="bg-[#EFF5FF] rounded-2xl border-2 border-dashed border-[#2E7DD1]/30 p-8 text-center">
        <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow">
          <HardDrive size={28} className="text-white" />
        </div>
        <h3 className="font-bold text-[#0D2B4E] mb-1">Conectar nova pasta do Drive</h3>
        <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
          Cole o link da pasta do Google Drive ou selecione diretamente na sua conta.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Cole o link da pasta do Google Drive..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#2E7DD1] transition"
          />
          <button className="px-5 py-3 rounded-xl gradient-primary text-white font-semibold text-sm shadow hover:opacity-90 transition shrink-0">
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}
