"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Camera, HardDrive, Globe, Lock, Save, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, Loader2, Layers } from "lucide-react";

const CATEGORIAS_EVENTO = ["Evento", "Congresso", "Treinamento", "Corporativo", "Workshop", "Palestra", "Confraternizacao", "Outros"];

// Extrai o folder ID do link do Google Drive
function extrairFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

type DiaForm = {
  id: string;
  titulo: string;
  data: string;
  descricao: string;
  driveLink: string;
};

function criarDias(dataInicio: string, dataFim: string, atuais: DiaForm[]) {
  if (!dataInicio || !dataFim || dataFim <= dataInicio) return [];
  const inicio = new Date(`${dataInicio}T12:00:00`);
  const fim = new Date(`${dataFim}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return [];

  const dias: DiaForm[] = [];
  for (let atual = new Date(inicio); atual <= fim && dias.length < 31; atual.setDate(atual.getDate() + 1)) {
    const data = atual.toISOString().slice(0, 10);
    const salvo = atuais.find((dia) => dia.data === data);
    dias.push(salvo ?? {
      id: `dia${dias.length + 1}`,
      titulo: `Dia ${dias.length + 1}`,
      data,
      descricao: "",
      driveLink: "",
    });
  }
  return dias;
}

export default function NovoEventoPage() {
  const [form, setForm] = useState({
    nome: "",
    data: "",
    dataFim: "",
    local: "",
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
  const [dias, setDias] = useState<DiaForm[]>([]);

  function toggle(field: "reconhecimento" | "download") {
    setForm((f) => ({ ...f, [field]: !f[field] }));
  }

  function handleDriveLink(link: string) {
    setForm({ ...form, driveLink: link });
    setDriveOk(!!extrairFolderId(link));
  }

  function atualizarPeriodo(field: "data" | "dataFim", value: string) {
    const proximo = { ...form, [field]: value };
    setForm(proximo);
    setDias((atuais) => criarDias(proximo.data, proximo.dataFim, atuais));
  }

  function atualizarDia(index: number, patch: Partial<DiaForm>) {
    setDias((atuais) => atuais.map((dia, posicao) => posicao === index ? { ...dia, ...patch } : dia));
  }

  async function handleSave() {
    setErro("");
    if (!form.nome || !form.data) {
      setErro("Preencha o nome e a data do evento.");
      return;
    }

    setSaving(true);
    try {
      const ehMultiDia = dias.length > 1;
      const folderId = ehMultiDia ? "" : extrairFolderId(form.driveLink) ?? "";
      if (!ehMultiDia && form.driveLink && !folderId) {
        setErro("Cole um link valido de pasta do Drive.");
        setSaving(false);
        return;
      }
      if (ehMultiDia && dias.some((dia) => !extrairFolderId(dia.driveLink))) {
        setErro("Informe um link de pasta do Drive valido para cada dia do evento.");
        setSaving(false);
        return;
      }

      const metadata = {
        nome: form.nome,
        data: form.data,
        data_fim: ehMultiDia ? form.dataFim : undefined,
        local: form.local.trim() || undefined,
        categoria: form.categoria,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        descricao: form.descricao,
        status: form.status,
        reconhecimento_facial: form.reconhecimento,
        download_liberado: form.download,
        acesso: form.acesso,
        folder_id: folderId,
        total_fotos: 0,
        dias: ehMultiDia ? dias.map((dia, index) => ({
          id: dia.id.trim() || `dia${index + 1}`,
          titulo: dia.titulo.trim() || `Dia ${index + 1}`,
          data: dia.data,
          descricao: dia.descricao.trim() || undefined,
          folder_id: extrairFolderId(dia.driveLink)!,
          total_fotos: 0,
          status: "disponivel" as const,
        })) : undefined,
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
      const eventoRes = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const evento = await eventoRes.json().catch(() => null);
      if (!eventoRes.ok) throw new Error(evento?.error ?? "Erro ao criar evento.");

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
          <p className="text-gray-500 text-sm">Crie uma galeria simples ou um evento com uma pasta do Drive para cada dia.</p>
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
                  onChange={(e) => atualizarPeriodo("data", e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Data final</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
                  <input
                    type="date"
                    min={form.data || undefined}
                    value={form.dataFim}
                    onChange={(e) => atualizarPeriodo("dataFim", e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Preencha para criar os dias internos do evento.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1A4A80] uppercase tracking-wider mb-1.5">Local</label>
                <input
                  type="text"
                  placeholder="Ex: Centro de Convencoes - SP"
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#EFF5FF] text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1] focus:ring-2 focus:ring-[#2E7DD1]/20 transition"
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
        {dias.length <= 1 ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
        </div> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-[#0D2B4E] mb-1 flex items-center gap-2">
              <Layers size={17} className="text-[#2E7DD1]" /> Dias e pastas do Drive
            </h2>
            <p className="text-gray-400 text-xs mb-4">
              {dias.length} dias gerados pelo periodo. Cole a pasta do Drive correspondente a cada dia.
            </p>
            <div className="space-y-3">
              {dias.map((dia, index) => {
                const pastaOk = !!extrairFolderId(dia.driveLink);
                return (
                  <div key={dia.data} className="rounded-xl border border-[#2E7DD1]/15 bg-[#EFF5FF]/70 p-3">
                    <div className="grid gap-2 sm:grid-cols-[115px_minmax(0,1fr)]">
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A4A80]">Dia {index + 1}</p>
                        <p className="text-xs font-semibold text-[#0D2B4E]">
                          {new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                      <input
                        type="text"
                        value={dia.titulo}
                        onChange={(e) => atualizarDia(index, { titulo: e.target.value })}
                        placeholder={`Nome do Dia ${index + 1}`}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1]"
                      />
                    </div>
                    <div className="relative mt-2">
                      <HardDrive size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
                      <input
                        type="text"
                        value={dia.driveLink}
                        onChange={(e) => atualizarDia(index, { driveLink: e.target.value })}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className={`w-full pl-9 pr-9 py-2.5 rounded-lg border bg-white text-sm text-[#0D2B4E] focus:outline-none ${pastaOk ? "border-emerald-400" : "border-gray-200 focus:border-[#2E7DD1]"}`}
                      />
                      {pastaOk && <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                    </div>
                    <input
                      type="text"
                      value={dia.descricao}
                      onChange={(e) => atualizarDia(index, { descricao: e.target.value })}
                      placeholder="Descricao curta deste dia"
                      className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-xs text-[#0D2B4E] focus:outline-none focus:border-[#2E7DD1]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
