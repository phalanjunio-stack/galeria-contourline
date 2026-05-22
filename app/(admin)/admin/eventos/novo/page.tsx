"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Camera, HardDrive, Globe, Lock, Save, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const CATEGORIAS_EVENTO = ["Evento", "Congresso", "Treinamento", "Corporativo", "Workshop", "Palestra", "Confraternizacao", "Outros"];

// Extrai o folder ID do link do Google Drive
function extrairFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function NovoEventoPage() {
  const [form, setForm] = useState({
    nome: "",
    data: "",
    categoria: "Evento",
    tags: "",
    descricao: "",
    status: "aberto",
    reconhecimento: true,
    download: true,
    acesso: "publico",
    driveLink: "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [driveOk, setDriveOk] = useState(false);

  function toggle(field: "reconhecimento" | "download") {
    setForm((f) => ({ ...f, [field]: !f[field] }));
  }

  function handleDriveLink(link: string) {
    setForm({ ...form, driveLink: link });
    setDriveOk(!!extrairFolderId(link));
  }

  async function handleSave() {
    setErro("");
    if (!form.nome || !form.data) {
      setErro("Preencha o nome e a data do evento.");
      return;
    }

    setSaving(true);
    try {
      const folderId = extrairFolderId(form.driveLink) ?? "";

      const metadata = {
        nome: form.nome,
        data: form.data,
        categoria: form.categoria,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        descricao: form.descricao,
        status: form.status,
        reconhecimento_facial: form.reconhecimento,
        download_liberado: form.download,
        acesso: form.acesso,
        folder_id: folderId,
        total_fotos: 0,
        criado_em: new Date().toISOString(),
      };

      // Salva _evento.json na pasta do Drive (se tiver pasta informada)
      if (folderId) {
        const res = await fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId,
            fileName: "_evento.json",
            data: metadata,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Erro ao salvar no Drive");
        }
      }

      // Salva também na lista local de eventos (API interna)
      await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });

      window.location.href = "/admin/eventos";
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao criar evento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/eventos"
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-[#EFF5FF] hover:text-[#2E7DD1] transition">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E]">Novo evento</h1>
          <p className="text-gray-500 text-sm">Preencha as informações do evento</p>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
          <AlertCircle size={16} className="shrink-0" /> {erro}
        </div>
      )}

      <div className="space-y-5">

        {/* Informações básicas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2B4E] mb-5 flex items-center gap-2">
            <Camera size={17} className="text-[#2E7DD1]" /> Informações do evento
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Nome do evento *</label>
              <input
                type="text"
                placeholder="Ex: Confraterização 2024"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Data do evento *</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Categoria</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
                >
                  {CATEGORIAS_EVENTO.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Tags</label>
                <input
                  type="text"
                  placeholder="Ex: saude, equipe, maio"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Descrição</label>
              <textarea
                placeholder="Descreva o evento..."
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Google Drive */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2B4E] mb-1 flex items-center gap-2">
            <HardDrive size={17} className="text-[#2E7DD1]" /> Google Drive
          </h2>
          <p className="text-gray-400 text-xs mb-4">Cole o link da pasta do Drive com as fotos. Pode ser de qualquer Drive, desde que compartilhado com o admin.</p>
          <div className="relative">
            <input
              type="text"
              placeholder="https://drive.google.com/drive/folders/..."
              value={form.driveLink}
              onChange={(e) => handleDriveLink(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none transition pr-10
                ${driveOk ? "border-emerald-400 focus:border-emerald-400" : "border-gray-200 focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20"}`}
            />
            {driveOk && (
              <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
            )}
          </div>
          {driveOk && (
            <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1">
              <CheckCircle size={12} /> Pasta do Drive reconhecida
            </p>
          )}
          {form.driveLink && !driveOk && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-amber-700 text-xs font-semibold flex items-center gap-1 mb-1">
                <AlertCircle size={12} /> Link inválido — esse é um link de arquivo, não de pasta.
              </p>
              <p className="text-amber-600 text-xs">
                No Drive, clique com o botão direito na <strong>pasta</strong> com as fotos → Compartilhar → Copiar link.<br />
                O link correto contém <code className="bg-amber-100 px-1 rounded">/folders/</code> na URL.
              </p>
            </div>
          )}
        </div>

        {/* Acesso */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2B4E] mb-5 flex items-center gap-2">
            <Globe size={17} className="text-[#2E7DD1]" /> Acesso ao evento
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "publico", label: "Público",  icon: Globe, desc: "Qualquer pessoa acessa" },
              { value: "link",    label: "Por link",  icon: Lock,  desc: "Só quem tem o link" },
              { value: "privado", label: "Privado",   icon: Lock,  desc: "Somente convidados" },
            ].map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                onClick={() => setForm({ ...form, acesso: value })}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition text-center
                  ${form.acesso === value ? "border-[#2E7DD1] bg-[#EFF5FF]" : "border-gray-200 hover:border-[#2E7DD1]/40"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.acesso === value ? "gradient-primary shadow" : "bg-gray-100"}`}>
                  <Icon size={15} className={form.acesso === value ? "text-white" : "text-gray-500"} />
                </div>
                <span className={`text-xs font-bold ${form.acesso === value ? "text-[#2E7DD1]" : "text-gray-600"}`}>{label}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-[#0D2B4E] mb-5">Permissões</h2>
          <div className="space-y-4">
            {[
              { field: "reconhecimento" as const, label: "Reconhecimento facial", desc: "Permite que pessoas encontrem fotos pelo rosto" },
              { field: "download" as const,       label: "Download liberado",      desc: "Permite baixar as fotos do evento" },
            ].map(({ field, label, desc }) => (
              <div key={field} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#EFF5FF] border border-[#2E7DD1]/10">
                <div>
                  <p className="font-semibold text-[#0D2B4E] text-sm">{label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                </div>
                <button onClick={() => toggle(field)} className="shrink-0">
                  {form[field]
                    ? <ToggleRight size={32} className="text-[#2E7DD1]" />
                    : <ToggleLeft  size={32} className="text-gray-300" />
                  }
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pb-8">
          <Link href="/admin/eventos"
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm text-center hover:bg-gray-50 transition">
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl gradient-primary text-white font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Criar evento</>}
          </button>
        </div>
      </div>
    </div>
  );
}
