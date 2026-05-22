"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, MapPin, Save, Loader2, Plus, X, GripVertical,
  Folder, FolderOpen, Clock, CheckCircle, AlertCircle, FileText, Sparkles,
  ChevronRight, MoreVertical, ChevronDown,
} from "lucide-react";

const CATEGORIAS = ["Evento", "Congresso", "Treinamento", "Corporativo", "Workshop", "Palestra", "Confraternizacao", "Outros"];

type ModoFotos = "unica" | "por_dia" | "depois";

interface DriveValidacao {
  estado: "idle" | "validando" | "ok" | "erro";
  nome?: string;
  totalImagens?: number;
  erro?: string;
}

interface DiaForm {
  id: string;
  titulo: string;
  data: string;
  descricao: string;
  driveLink: string;
  validacao?: DriveValidacao;
}

function extrairFolderId(value: string): string | null {
  if (!value) return null;
  const link = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (link) return link[1];
  const limpo = value.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(limpo)) return limpo;
  return null;
}

function gerarDias(dataInicio: string, dataFim: string, atuais: DiaForm[]): DiaForm[] {
  if (!dataInicio || !dataFim || dataFim < dataInicio) return [];
  const inicio = new Date(`${dataInicio}T12:00:00`);
  const fim = new Date(`${dataFim}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return [];
  const dias: DiaForm[] = [];
  for (let d = new Date(inicio); d <= fim && dias.length < 31; d.setDate(d.getDate() + 1)) {
    const data = d.toISOString().slice(0, 10);
    const existente = atuais.find(x => x.data === data);
    dias.push(existente ?? {
      id: `dia${dias.length + 1}`,
      titulo: `Dia ${dias.length + 1}`,
      data,
      descricao: "",
      driveLink: "",
    });
  }
  return dias;
}

function fmtData(iso: string) {
  if (!iso) return "—";
  try { return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}

const DRIVE_LOGO = "https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png";

export default function NovoEventoPage() {
  const [form, setForm] = useState({
    nome: "", data: "", dataFim: "", local: "",
    categoria: "Evento", descricao: "", status: "aberto",
    reconhecimento: true, download: true,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [modoFotos, setModoFotos] = useState<ModoFotos>("unica");
  const [folderPrincipal, setFolderPrincipal] = useState("");
  const [validacaoPrincipal, setValidacaoPrincipal] = useState<DriveValidacao>({ estado: "idle" });
  const [dias, setDias] = useState<DiaForm[]>([]);
  const [linksBackup, setLinksBackup] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const ehMultiDia = useMemo(() => !!(form.data && form.dataFim && form.dataFim > form.data), [form.data, form.dataFim]);
  const totalDias = ehMultiDia ? dias.length : 1;

  useEffect(() => {
    if (!ehMultiDia) { setDias([]); return; }
    setDias(atuais => gerarDias(form.data, form.dataFim, atuais));
  }, [form.data, form.dataFim, ehMultiDia]);

  const trocarModo = useCallback((novoModo: ModoFotos) => {
    if (modoFotos === "por_dia" && novoModo !== "por_dia") {
      const bk: Record<string, string> = {};
      dias.forEach(d => { if (d.driveLink) bk[d.data] = d.driveLink; });
      if (Object.keys(bk).length) setLinksBackup(prev => ({ ...prev, ...bk }));
    }
    if (novoModo === "por_dia" && Object.keys(linksBackup).length) {
      setDias(atuais => atuais.map(d => ({ ...d, driveLink: d.driveLink || linksBackup[d.data] || "" })));
    }
    setModoFotos(novoModo);
  }, [modoFotos, dias, linksBackup]);

  async function validarPasta(folderId: string): Promise<DriveValidacao> {
    if (!folderId) return { estado: "idle" };
    try {
      const res = await fetch(`/api/admin/drive-folder?id=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      if (data.ok) return { estado: "ok", nome: data.name, totalImagens: data.totalImagens };
      return { estado: "erro", erro: data.error ?? "Falha na validação" };
    } catch (err) {
      return { estado: "erro", erro: String(err) };
    }
  }

  async function handleValidarPrincipal() {
    const fid = extrairFolderId(folderPrincipal);
    if (!fid) {
      setValidacaoPrincipal({ estado: "erro", erro: "Link/ID inválido. Use o link da pasta (/folders/...) ou o ID puro." });
      return;
    }
    setValidacaoPrincipal({ estado: "validando" });
    setValidacaoPrincipal(await validarPasta(fid));
  }

  async function validarDia(index: number) {
    const dia = dias[index];
    const fid = extrairFolderId(dia.driveLink);
    if (!fid) {
      setDias(atuais => atuais.map((d, i) => i === index ? { ...d, validacao: { estado: "erro", erro: "Link inválido" } } : d));
      return;
    }
    setDias(atuais => atuais.map((d, i) => i === index ? { ...d, validacao: { estado: "validando" } } : d));
    const r = await validarPasta(fid);
    setDias(atuais => atuais.map((d, i) => i === index ? { ...d, validacao: r } : d));
  }

  function atualizarDia(index: number, patch: Partial<DiaForm>) {
    setDias(atuais => atuais.map((d, i) => i === index ? { ...d, ...patch } : d));
  }
  function removerDia(index: number) { setDias(atuais => atuais.filter((_, i) => i !== index)); }
  function adicionarDia() {
    const ultima = dias[dias.length - 1];
    const proximaData = ultima
      ? new Date(new Date(`${ultima.data}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10)
      : form.data || new Date().toISOString().slice(0, 10);
    setDias([...dias, {
      id: `dia${dias.length + 1}`, titulo: `Dia ${dias.length + 1}`,
      data: proximaData, descricao: "", driveLink: "",
    }]);
    if (!form.dataFim || proximaData > form.dataFim) setForm(f => ({ ...f, dataFim: proximaData }));
  }
  function usarPastaPrincipal(index: number) {
    if (!folderPrincipal) return;
    atualizarDia(index, { driveLink: folderPrincipal });
  }
  function adicionarTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags([...tags, t]);
    setTagInput("");
  }

  const pastasOk = useMemo(() => {
    if (modoFotos === "depois") return 0;
    if (modoFotos === "unica") return validacaoPrincipal.estado === "ok" ? 1 : 0;
    return dias.filter(d => d.validacao?.estado === "ok" || extrairFolderId(d.driveLink)).length;
  }, [modoFotos, validacaoPrincipal, dias]);

  const statusFinal = useMemo<{ label: string; tone: "ok" | "warn" | "info"; detalhe: string }>(() => {
    if (!form.nome || !form.data) return { label: "Configuração incompleta", tone: "warn", detalhe: "Preencha nome e data inicial" };
    if (modoFotos === "depois") return { label: "Pronto para salvar", tone: "info", detalhe: "Pastas serão configuradas depois" };
    if (modoFotos === "unica") {
      if (validacaoPrincipal.estado === "ok") return { label: "Pronto para indexar", tone: "ok", detalhe: `${validacaoPrincipal.totalImagens ?? 0} fotos encontradas` };
      if (validacaoPrincipal.estado === "validando") return { label: "Validando pasta...", tone: "info", detalhe: "Aguarde" };
      return { label: "Faltam links de Drive", tone: "warn", detalhe: "Valide a pasta principal" };
    }
    const pendentes = dias.filter(d => !extrairFolderId(d.driveLink)).length;
    if (pendentes === 0 && dias.length > 0) return { label: "Pronto para indexar", tone: "ok", detalhe: `${dias.length} pastas configuradas` };
    return { label: "Faltam links de Drive", tone: "warn", detalhe: `${pendentes} dia(s) sem pasta` };
  }, [form, modoFotos, validacaoPrincipal, dias]);

  async function salvar() {
    setErro("");
    if (!form.nome || !form.data) { setErro("Preencha o nome e a data inicial."); return; }
    setSaving(true);
    try {
      const folderId = modoFotos === "unica" ? (extrairFolderId(folderPrincipal) ?? "") : "";
      const usarDias = ehMultiDia && modoFotos !== "depois";
      const metadata = {
        nome: form.nome, data: form.data,
        data_fim: ehMultiDia ? form.dataFim : undefined,
        local: form.local.trim() || undefined,
        categoria: form.categoria, tags,
        descricao: form.descricao, status: form.status,
        reconhecimento_facial: form.reconhecimento,
        download_liberado: form.download, acesso: "publico",
        folder_id: folderId,
        total_fotos: validacaoPrincipal.totalImagens ?? 0,
        dias: usarDias ? dias.map((d, i) => ({
          id: d.id.trim() || `dia${i + 1}`,
          titulo: d.titulo.trim() || `Dia ${i + 1}`,
          data: d.data,
          descricao: d.descricao.trim() || undefined,
          folder_id: modoFotos === "por_dia" ? (extrairFolderId(d.driveLink) ?? "") : folderId,
          total_fotos: d.validacao?.totalImagens ?? 0,
          status: "disponivel" as const,
        })) : undefined,
        criado_em: new Date().toISOString(),
      };
      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erro ao criar evento.");
      window.location.href = "/admin/eventos";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar evento.");
    } finally {
      setSaving(false);
    }
  }

  const folderIdPrincipal = extrairFolderId(folderPrincipal);
  const pastaPrincipalNome = validacaoPrincipal.estado === "ok" ? validacaoPrincipal.nome : null;

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/eventos" className="w-11 h-11 rounded-full border border-[#c4d6f4] bg-[#f2f7ff] text-[#102658] flex items-center justify-center hover:bg-[#e7efff] transition shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[28px] font-extrabold text-[#061844] tracking-tight leading-tight">Cadastro de evento</h1>
            <p className="text-[#415d86] text-sm mt-0.5">Informações, origem das fotos e dias do evento</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/eventos" className="h-12 px-6 rounded-xl border border-[#b9cbea] bg-gradient-to-b from-[#f9fbff] to-[#edf4ff] text-[#061844] font-extrabold text-sm flex items-center hover:shadow-md transition">
            Cancelar
          </Link>
          <button
            onClick={salvar}
            disabled={saving}
            className="h-12 px-6 rounded-xl bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg hover:shadow-xl flex items-center gap-2 transition disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar evento
          </button>
        </div>
      </header>

      {erro && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{erro}
        </div>
      )}

      {/* Layout 2 colunas */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_430px] gap-6 items-start">
        {/* ─── COLUNA PRINCIPAL ─── */}
        <div className="space-y-4 min-w-0">
          {/* 1. Informações principais */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
            <SectionHeader num="1" title="Informações principais" />
            <div className="grid grid-cols-1 sm:grid-cols-[2.2fr_0.95fr_0.95fr] gap-x-7 gap-y-4 mt-5">
              <Field label="Nome do evento">
                <Input value={form.nome} onChange={v => setForm({ ...form, nome: v })} placeholder="Ex: CBCD - Congresso..." />
              </Field>
              <Field label="Categoria">
                <Select value={form.categoria} onChange={v => setForm({ ...form, categoria: v })} options={CATEGORIAS.map(c => ({ value: c, label: c }))} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={v => setForm({ ...form, status: v })} options={[
                  { value: "aberto", label: "🟢 Aberto" },
                  { value: "privado", label: "🟡 Privado" },
                  { value: "encerrado", label: "⚪ Encerrado" },
                ]} />
              </Field>
              <Field label="Data inicial">
                <Input type="date" value={form.data} onChange={v => setForm({ ...form, data: v })} icon={<Calendar size={15} />} />
              </Field>
              <Field label="Data final">
                <Input type="date" min={form.data || undefined} value={form.dataFim} onChange={v => setForm({ ...form, dataFim: v })} icon={<Calendar size={15} />} />
              </Field>
              <Field label="Local">
                <Input value={form.local} onChange={v => setForm({ ...form, local: v })} placeholder="Cidade ou local" icon={<MapPin size={15} />} />
              </Field>
              <Field label="Tags (opcional)">
                <div className="flex flex-wrap items-center gap-2 min-h-12 border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] rounded-[10px] px-2.5 py-2 focus-within:border-[#145dff] transition">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 bg-[#dfeaff] text-[#061844] font-extrabold text-xs px-2.5 py-1 rounded-lg">
                      {t}
                      <button onClick={() => setTags(tags.filter(x => x !== t))} className="text-[#58739c] hover:text-red-500">
                        <X size={11} strokeWidth={3} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); adicionarTag(); } }}
                    onBlur={adicionarTag}
                    placeholder={tags.length === 0 ? "Adicionar tag..." : "Adicionar tag..."}
                    className="flex-1 min-w-[100px] bg-transparent text-sm text-[#061844] outline-none placeholder:text-[#58739c]"
                  />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descrição">
                  <textarea
                    value={form.descricao}
                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                    rows={3}
                    placeholder="Descreva o evento..."
                    className="w-full min-h-16 px-4 py-3 rounded-[10px] border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-sm text-[#061844] outline-none focus:border-[#145dff] resize-none leading-snug"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* 2. Fotos do evento */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
            <SectionHeader num="2" title="Fotos do evento" />
            <p className="text-[#415d86] text-sm -mt-1.5 mb-4">Como as fotos estão organizadas?</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ModoCard
                active={modoFotos === "unica"}
                onClick={() => trocarModo("unica")}
                tone="blue"
                icon={<FolderOpen size={26} strokeWidth={2} />}
                title="Uma pasta única"
                desc="Uma pasta para todo o evento inteiro"
              />
              <ModoCard
                active={modoFotos === "por_dia"}
                onClick={() => trocarModo("por_dia")}
                tone="purple"
                icon={<Folder size={26} strokeWidth={2} />}
                title="Pasta separada por dia"
                desc="Uma pasta diferente para cada dia"
                disabled={!ehMultiDia}
                disabledHint="Defina uma data final maior que a inicial"
              />
              <ModoCard
                active={modoFotos === "depois"}
                onClick={() => trocarModo("depois")}
                tone="orange"
                icon={<Clock size={26} strokeWidth={2} />}
                title="Configurar depois"
                desc="Cadastrar o evento sem pasta de fotos agora"
              />
            </div>

            {modoFotos === "unica" && (
              <div className="mt-5">
                <label className="block text-xs font-extrabold text-[#061844] mb-2">Pasta principal do Google Drive</label>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="flex items-center min-h-12 border border-[#bfd0ec] rounded-[10px] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] overflow-hidden">
                    <div className="w-14 flex items-center justify-center shrink-0">
                      <img src={DRIVE_LOGO} alt="Google Drive" className="w-6 h-6" />
                    </div>
                    <input
                      value={folderPrincipal}
                      onChange={e => { setFolderPrincipal(e.target.value); setValidacaoPrincipal({ estado: "idle" }); }}
                      placeholder="Cole o link da pasta ou ID do Google Drive"
                      className="flex-1 min-w-0 bg-transparent text-sm text-[#061844] outline-none truncate py-3 pr-2"
                    />
                    {validacaoPrincipal.estado === "ok" && (
                      <span className="mr-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ddf7e8] text-[#058139] font-extrabold text-xs">
                        <CheckCircle size={12} strokeWidth={3} /> Validada
                      </span>
                    )}
                    {validacaoPrincipal.estado === "validando" && (
                      <span className="mr-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e7f0ff] text-[#145dff] font-extrabold text-xs">
                        <Loader2 size={12} className="animate-spin" /> Validando
                      </span>
                    )}
                    {validacaoPrincipal.estado === "erro" && (
                      <span className="mr-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-extrabold text-xs">
                        <AlertCircle size={12} /> Erro
                      </span>
                    )}
                    <ChevronDown size={16} className="text-[#557095] mr-3" />
                  </div>
                  {validacaoPrincipal.estado === "ok" ? (
                    <button
                      onClick={() => { setFolderPrincipal(""); setValidacaoPrincipal({ estado: "idle" }); }}
                      className="h-12 px-5 rounded-[10px] border border-[#b9cbea] bg-gradient-to-b from-[#f9fbff] to-[#edf4ff] text-[#061844] font-extrabold text-sm hover:shadow-md"
                    >
                      Alterar
                    </button>
                  ) : (
                    <button
                      onClick={handleValidarPrincipal}
                      disabled={!folderPrincipal || validacaoPrincipal.estado === "validando"}
                      className="h-12 px-5 rounded-[10px] bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg disabled:opacity-50"
                    >
                      Validar
                    </button>
                  )}
                </div>

                {validacaoPrincipal.estado === "ok" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 px-4 min-h-11 rounded-[10px] bg-gradient-to-r from-[#dcf8e8] to-[#eefdf4] border border-[#b7eccb] text-xs text-[#047a32] py-2">
                    <CheckCircle size={14} strokeWidth={3} />
                    <span>Pasta encontrada:</span>
                    <strong className="text-[#061844]">{validacaoPrincipal.nome}</strong>
                    <span className="text-gray-400">·</span>
                    <span>ID: <code className="font-mono">{folderIdPrincipal}</code></span>
                    <span className="text-gray-400">·</span>
                    <strong className="text-[#061844]">{validacaoPrincipal.totalImagens?.toLocaleString("pt-BR")} arquivos</strong>
                  </div>
                )}
                {validacaoPrincipal.estado === "erro" && (
                  <div className="mt-3 px-4 py-2.5 rounded-[10px] bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle size={13} /> {validacaoPrincipal.erro}
                  </div>
                )}
              </div>
            )}

            {modoFotos === "depois" && (
              <div className="mt-5 px-4 py-3 rounded-[10px] bg-[#fff0df] border border-[#ffd8b5] text-xs text-[#a04d00] flex items-center gap-2">
                <Clock size={14} /> Aguardando configuração das fotos. Você pode cadastrar as pastas a qualquer momento.
              </div>
            )}
          </section>

          {/* 3. Dias do evento */}
          {ehMultiDia && (
            <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <SectionHeader num="3" title="Dias do evento" inline />
                  <span className="inline-flex items-center h-8 px-4 rounded-full bg-[#ddf7e8] text-[#047a32] border border-[#c0efcf] font-extrabold text-xs">
                    {dias.length} dias detectados automaticamente
                  </span>
                </div>
                <button onClick={adicionarDia} className="h-10 px-5 rounded-[10px] bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg inline-flex items-center gap-1.5">
                  <Plus size={14} strokeWidth={3} /> Adicionar dia
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {dias.map((dia, i) => (
                  <DiaCard
                    key={`${dia.data}-${i}`}
                    dia={dia}
                    ordem={i + 1}
                    modoFotos={modoFotos}
                    pastaPrincipalNome={pastaPrincipalNome}
                    onChange={p => atualizarDia(i, p)}
                    onRemove={() => removerDia(i)}
                    onValidar={() => validarDia(i)}
                    onUsarPrincipal={() => usarPastaPrincipal(i)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ─── COLUNA SIDEBAR (RESUMO) ─── */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start min-w-0">
          {/* Resumo */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-6">
            <h3 className="flex items-center gap-3 font-extrabold text-lg text-[#061844] mb-4">
              <Sparkles size={22} className="text-[#145dff]" /> Resumo do evento
            </h3>

            <div className="grid grid-cols-[72px_1fr] gap-4 items-center px-5 py-5 bg-gradient-to-b from-white to-[#f4f8ff] rounded-2xl mb-4">
              <div className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center text-white bg-gradient-to-br from-[#3d8cff] to-[#145dff] shadow-[0_16px_26px_rgba(20,93,255,.24)]">
                <Calendar size={32} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-extrabold text-[#061844] leading-tight tracking-tight line-clamp-3">
                  {form.nome || "Nome do evento"}
                </h4>
                <StatusPill status={form.status} />
              </div>
            </div>

            <div className="space-y-3 mx-1.5 mb-5 text-sm text-[#15315c]">
              {form.local && (
                <div className="flex items-center gap-3"><MapPin size={15} className="text-[#145dff]" /><span>{form.local}</span></div>
              )}
              {form.data && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Calendar size={15} className="text-[#145dff]" />
                  <span>{fmtData(form.data)}</span>
                  {ehMultiDia && (<><span className="text-gray-400">até</span><span>{fmtData(form.dataFim)}</span></>)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <MiniCard tone="blue" icon={<Calendar size={20} className="text-[#145dff]" />} valor={`${totalDias} dia${totalDias > 1 ? "s" : ""}`} label="de evento" />
              <MiniCard
                tone="green"
                icon={modoFotos === "unica"
                  ? <img src={DRIVE_LOGO} alt="" className="w-5 h-5" />
                  : modoFotos === "por_dia"
                    ? <Folder size={20} className="text-[#7d3cff]" />
                    : <Clock size={20} className="text-[#ff8a1f]" />}
                valor={modoFotos === "unica" ? "Pasta única" : modoFotos === "por_dia" ? "Pasta por dia" : "Depois"}
                label={modoFotos === "unica" ? "para todo evento" : modoFotos === "por_dia" ? `${pastasOk}/${dias.length} configuradas` : "configurar depois"}
              />
              <MiniCard
                tone="purple"
                icon={<FileText size={20} className="text-[#7d3cff]" />}
                valor={(validacaoPrincipal.totalImagens ?? dias.reduce((s, d) => s + (d.validacao?.totalImagens ?? 0), 0)).toLocaleString("pt-BR")}
                label="arquivos encontrados"
              />
              <MiniCard
                tone={statusFinal.tone === "ok" ? "green" : statusFinal.tone === "warn" ? "orange" : "blue"}
                icon={statusFinal.tone === "ok"
                  ? <CheckCircle size={20} className="text-[#20b75a]" />
                  : statusFinal.tone === "warn"
                    ? <AlertCircle size={20} className="text-[#ff8a1f]" />
                    : <Clock size={20} className="text-[#145dff]" />}
                valor={statusFinal.label}
                label={statusFinal.detalhe}
              />
            </div>
          </section>

          {/* Dias do evento (timeline) */}
          {ehMultiDia && dias.length > 0 && (
            <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-6">
              <h3 className="font-extrabold text-lg text-[#061844] mb-2">Dias do evento</h3>
              <div className="pt-2">
                {dias.map((d, i) => {
                  const pastaOk = modoFotos === "depois"
                    ? false
                    : modoFotos === "unica"
                      ? validacaoPrincipal.estado === "ok"
                      : !!extrairFolderId(d.driveLink);
                  const isLast = i === dias.length - 1;
                  return (
                    <div key={d.data} className="relative grid grid-cols-[39px_1fr_auto] gap-4 min-h-[76px] items-start">
                      {!isLast && (
                        <span className="absolute left-[18px] top-[39px] bottom-[-4px] border-l-[3px] border-dotted border-[#145dff]/55" />
                      )}
                      <div className={`w-[38px] h-[38px] rounded-full text-white font-black flex items-center justify-center shadow-[0_8px_16px_rgba(20,93,255,.24)] z-10 ${i % 2 === 1 ? "bg-gradient-to-br from-[#a245ff] to-[#7d3cff]" : "bg-gradient-to-br from-[#145dff] to-[#074ee6]"}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 pt-1">
                        <strong className="text-sm text-[#061844] block leading-tight">Dia {i + 1} — {fmtData(d.data)}</strong>
                        <span className="block mt-1 text-xs text-[#415d86] truncate">{d.titulo}</span>
                      </div>
                      <span className={`mt-1 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-extrabold shrink-0 ${pastaOk ? "bg-[#ddf7e8] text-[#047a32] border border-[#c0efcf]" : "bg-[#fff0df] text-[#a04d00] border border-[#ffd8b5]"}`}>
                        {pastaOk ? <><CheckCircle size={11} strokeWidth={3} /> Pronto</> : <><Clock size={11} /> Aguardando</>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Dica */}
          <section className="p-5 rounded-[18px] border border-[#9fc4ff] bg-gradient-to-b from-[#eef6ff] to-[#e8f2ff] flex gap-3">
            <Sparkles size={22} className="text-[#145dff] shrink-0" />
            <div>
              <strong className="block text-base text-[#061844] mb-1">Dica</strong>
              <p className="text-sm text-[#12325f] leading-snug">
                Você pode editar os dias, nomes, descrições e pastas a qualquer momento.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ───── Componentes ───── */

function SectionHeader({ num, title, inline }: { num: string; title: string; inline?: boolean }) {
  return (
    <div className={`flex items-center gap-3.5 ${inline ? "" : "mb-4"}`}>
      <span className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-[#2878ff] to-[#0d4cf4] text-white font-black text-sm flex items-center justify-center shadow-[0_5px_14px_rgba(20,93,255,.28)]">
        {num}
      </span>
      <h2 className="text-xl font-extrabold tracking-tight text-[#061844]">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-2 text-xs font-extrabold text-[#061844]">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text", icon, min }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; icon?: React.ReactNode; min?: string;
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#145dff] pointer-events-none">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        className={`w-full min-h-12 ${icon ? "pl-10" : "pl-4"} pr-4 rounded-[10px] border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-[15px] text-[#061844] outline-none focus:border-[#145dff] shadow-[inset_0_1px_1px_rgba(255,255,255,.85)]`}
      />
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full min-h-12 pl-4 pr-10 rounded-[10px] border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-[15px] text-[#061844] outline-none focus:border-[#145dff] shadow-[inset_0_1px_1px_rgba(255,255,255,.85)] appearance-none cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#557095] pointer-events-none" strokeWidth={3} />
    </div>
  );
}

function ModoCard({ active, onClick, tone, icon, title, desc, disabled, disabledHint }: {
  active: boolean; onClick: () => void; tone: "blue" | "purple" | "orange";
  icon: React.ReactNode; title: string; desc: string;
  disabled?: boolean; disabledHint?: string;
}) {
  const toneIcon = tone === "blue"
    ? "bg-[#dceaff] text-[#145dff]"
    : tone === "purple"
      ? "bg-[#efe5ff] text-[#7d3cff]"
      : "bg-[#fff0df] text-[#ff8a1f]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={`relative text-left min-h-[110px] p-4 pl-12 rounded-xl bg-gradient-to-b from-white to-[#f5f9ff] flex items-center gap-3.5 transition
        ${active ? "border-2 border-[#145dff] shadow-[0_12px_26px_rgba(20,93,255,.11)]" : "border border-[#c6d4ec] hover:border-[#145dff]/40"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Radio */}
      <span className={`absolute top-4 left-4 w-5 h-5 rounded-full ${active ? "border-[6px] border-[#145dff]" : "border-2 border-[#8da7ce] bg-white"}`} />
      <div className={`w-14 h-14 rounded-full ${toneIcon} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <strong className="block text-[15px] text-[#061844] mb-1">{title}</strong>
        <small className="block text-[13px] text-[#3f587e] leading-snug">{desc}</small>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const conf = status === "aberto"
    ? { bg: "bg-[#ddf7e8]", text: "text-[#047a32]", label: "Aberto" }
    : status === "privado"
      ? { bg: "bg-[#fff0df]", text: "text-[#a04d00]", label: "Privado" }
      : { bg: "bg-gray-100", text: "text-gray-600", label: "Encerrado" };
  return (
    <span className={`inline-flex mt-2.5 px-3 py-1.5 rounded-full font-extrabold text-xs ${conf.bg} ${conf.text}`}>
      {conf.label}
    </span>
  );
}

function MiniCard({ tone, icon, valor, label }: {
  tone: "blue" | "green" | "purple" | "orange";
  icon: React.ReactNode; valor: string; label: string;
}) {
  const bg = tone === "blue"
    ? "from-[#eef5ff] to-[#e5efff] border-[#c6d7f2]"
    : tone === "green"
      ? "from-[#effdf5] to-[#e3f8eb] border-[#c8ecd6]"
      : tone === "purple"
        ? "from-[#f5efff] to-[#eadfff] border-[#dfd0ff]"
        : "from-[#fff6ec] to-[#ffeddd] border-[#ffd8b5]";
  return (
    <div className={`min-h-[80px] px-4 py-3.5 rounded-[10px] border bg-gradient-to-b ${bg} flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <b className="block text-base font-extrabold text-[#061844] leading-tight truncate">{valor}</b>
        <small className="block text-xs text-[#415d86] mt-0.5">{label}</small>
      </div>
    </div>
  );
}

function DiaCard({ dia, ordem, modoFotos, pastaPrincipalNome, onChange, onRemove, onValidar, onUsarPrincipal }: {
  dia: DiaForm; ordem: number; modoFotos: ModoFotos;
  pastaPrincipalNome: string | null;
  onChange: (p: Partial<DiaForm>) => void;
  onRemove: () => void;
  onValidar: () => void;
  onUsarPrincipal: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const showLink = modoFotos === "por_dia";
  const pastaOk = modoFotos === "unica"
    ? !!pastaPrincipalNome
    : dia.validacao?.estado === "ok";

  return (
    <div className="border border-[#c9d7ec] rounded-xl p-3.5 bg-gradient-to-b from-white to-[#f8fbff]">
      <div className="grid grid-cols-[18px_auto_1fr] gap-2.5 items-center mb-3">
        <GripVertical size={18} className="text-[#7190bb] cursor-grab" />
        <span className="inline-flex h-7 px-4 items-center justify-center rounded-full bg-[#dceaff] text-[#145dff] font-extrabold text-sm">
          Dia {ordem}
        </span>
        <div className="flex items-center justify-end gap-1.5 text-[#061844] text-sm">
          <Calendar size={13} className="text-[#145dff]" />
          <input
            type="date"
            value={dia.data}
            onChange={e => onChange({ data: e.target.value })}
            className="bg-transparent outline-none text-sm font-semibold text-[#061844] cursor-pointer"
          />
        </div>
      </div>

      <input
        value={dia.titulo}
        onChange={e => onChange({ titulo: e.target.value })}
        placeholder={`Nome do Dia ${ordem}`}
        className="w-full h-10 px-3 mb-2 border border-[#cbd7ea] rounded-lg bg-gradient-to-b from-white to-[#f7fbff] text-sm text-[#061844] outline-none focus:border-[#145dff]"
      />
      <input
        value={dia.descricao}
        onChange={e => onChange({ descricao: e.target.value })}
        placeholder="Descrição (opcional)"
        className="w-full h-10 px-3 border border-[#cbd7ea] rounded-lg bg-gradient-to-b from-white to-[#f7fbff] text-sm text-[#3f587e] outline-none focus:border-[#145dff]"
      />

      {/* Pasta */}
      {showLink ? (
        <div className="mt-3">
          <div className="relative">
            <Folder size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7d3cff]" />
            <input
              value={dia.driveLink}
              onChange={e => onChange({ driveLink: e.target.value, validacao: { estado: "idle" } })}
              placeholder="Link da pasta no Drive"
              className={`w-full h-9 pl-8 pr-8 rounded-lg border bg-white text-xs text-[#061844] outline-none
                ${dia.validacao?.estado === "ok" ? "border-emerald-400" : dia.validacao?.estado === "erro" ? "border-red-300" : "border-[#cbd7ea] focus:border-[#145dff]"}`}
            />
            {dia.validacao?.estado === "ok" && <CheckCircle size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500" />}
            {dia.validacao?.estado === "validando" && <Loader2 size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#145dff] animate-spin" />}
            {dia.validacao?.estado === "erro" && <AlertCircle size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
          </div>
          {dia.validacao?.estado === "ok" && (
            <p className="mt-1.5 text-[11px] text-emerald-600 font-semibold truncate">
              ✓ {dia.validacao.nome} · {dia.validacao.totalImagens?.toLocaleString("pt-BR")} fotos
            </p>
          )}
        </div>
      ) : modoFotos === "unica" && pastaPrincipalNome ? (
        <div className="mt-3 flex items-start gap-2.5 text-sm font-extrabold text-[#0c54e8]">
          <Folder size={16} className="text-[#0c54e8] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="block leading-tight">Usando pasta principal</span>
            <span className="block text-[#39567d] text-xs font-semibold mt-0.5 truncate">{pastaPrincipalNome}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#fff0df] border border-[#ffd8b5]">
          <Clock size={13} className="text-[#a04d00] shrink-0" />
          <p className="text-[11px] text-[#a04d00] font-extrabold">Aguardando configuração</p>
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-extrabold border
          ${pastaOk ? "bg-[#ddf7e8] text-[#047a32] border-[#c0efcf]" : "bg-[#fff0df] text-[#a04d00] border-[#ffd8b5]"}`}>
          {pastaOk ? <><CheckCircle size={11} strokeWidth={3} /> Pronto</> : <><Clock size={11} /> Aguardando</>}
        </span>
        <div className="relative">
          <button onClick={() => setMenu(v => !v)} className="w-7 h-7 rounded-lg hover:bg-gray-100 text-[#061844] flex items-center justify-center">
            <MoreVertical size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px]">
              {showLink && extrairFolderId(dia.driveLink) && (
                <button onClick={() => { onValidar(); setMenu(false); }} className="w-full px-3 py-2 text-xs text-[#061844] hover:bg-gray-50 text-left flex items-center gap-2">
                  <CheckCircle size={12} /> Validar pasta
                </button>
              )}
              {showLink && (
                <button onClick={() => { onUsarPrincipal(); setMenu(false); }} className="w-full px-3 py-2 text-xs text-[#061844] hover:bg-gray-50 text-left flex items-center gap-2">
                  <ChevronRight size={12} /> Usar pasta principal
                </button>
              )}
              <button onClick={() => { onRemove(); setMenu(false); }} className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left flex items-center gap-2">
                <X size={12} /> Remover dia
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
