"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Calendar, MapPin, Save, Loader2, Plus, X,
  Folder, Clock, CheckCircle, FileText, Sparkles,
  ChevronDown, Trash2, ToggleLeft, ToggleRight, Image as ImageIcon, Upload,
  ScanFace,
} from "lucide-react";
import type { EventoItem, EventoDia } from "@/app/api/eventos/route";
import FocalPointPicker from "@/app/components/FocalPointPicker";

const CATEGORIAS = ["Evento", "Congresso", "Treinamento", "Corporativo", "Workshop", "Palestra", "Confraternizacao", "Outros"];
const DRIVE_LOGO = "https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png";

function extrairFolderId(value: string): string {
  if (!value) return "";
  const link = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (link) return link[1];
  return value.trim();
}

function fmtData(iso: string) {
  if (!iso) return "—";
  try { return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}

export default function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [evento, setEvento]  = useState<EventoItem | null>(null);
  const [form, setForm] = useState({
    nome: "", data: "", data_fim: "", local: "",
    categoria: "Evento", descricao: "", status: "aberto",
    folder_id: "", capa_position: "center",
    banner_id: "" as string, banner_position: "center right",
    auto_dias_por_data: false,
    reconhecimento_facial: true, download_liberado: true,
  });
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerErro, setBannerErro] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dias, setDias] = useState<EventoDia[]>([]);
  const [diasOverrides, setDiasOverrides] = useState<Record<string, { capa_id?: string; capa_position?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [erro,    setErro]    = useState("");
  // Seletor de capa: dia atualmente escolhendo a foto
  const [capaPickerDia, setCapaPickerDia] = useState<EventoDia | null>(null);

  // Diagnostico do auto-dia
  interface DiasPreview {
    totalFotos: number; diasDetectados: number;
    dias: { ordem: number; data: string; total: number }[];
    semData: number; foraPeriodo: number; porExif: number; porCreatedTime: number;
    periodo: { inicio?: string; fim?: string }; semPasta?: boolean; error?: string;
  }
  const [diasPreview, setDiasPreview] = useState<DiasPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function carregarDiasPreview() {
    setPreviewLoading(true);
    setDiasPreview(null);
    try {
      const r = await fetch(`/api/eventos/dias-preview?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await r.json();
      setDiasPreview(data);
    } catch (e) {
      setDiasPreview({ totalFotos: 0, diasDetectados: 0, dias: [], semData: 0, foraPeriodo: 0, porExif: 0, porCreatedTime: 0, periodo: {}, error: String(e) });
    } finally {
      setPreviewLoading(false);
    }
  }

  const ehMultiDia = useMemo(() => !!(form.data && form.data_fim && form.data_fim > form.data) || dias.length > 0, [form.data, form.data_fim, dias.length]);
  const totalDias = ehMultiDia ? Math.max(dias.length, 1) : 1;

  const statusFinal = useMemo<{ label: string; tone: "ok" | "warn" | "info"; detalhe: string }>(() => {
    if (!form.nome || !form.data) return { label: "Configuração incompleta", tone: "warn", detalhe: "Preencha nome e data" };
    const pastas = (form.folder_id ? 1 : 0) + dias.filter(d => d.folder_id).length;
    if (pastas === 0) return { label: "Sem pasta no Drive", tone: "warn", detalhe: "Configure ao menos uma pasta" };
    return { label: "Pronto para salvar", tone: "ok", detalhe: `${pastas} pasta(s) configurada(s)` };
  }, [form.nome, form.data, form.folder_id, dias]);

  useEffect(() => {
    fetch("/api/eventos", { cache: "no-store" })
      .then(r => r.json())
      .then((eventos: EventoItem[]) => {
        const atual = Array.isArray(eventos) ? eventos.find(e => e.id === id) ?? null : null;
        setEvento(atual);
        if (!atual) return;
        setForm({
          nome: atual.nome ?? "",
          data: atual.data?.slice(0, 10) ?? "",
          data_fim: atual.data_fim?.slice(0, 10) ?? "",
          local: atual.local ?? "",
          categoria: atual.categoria ?? "Evento",
          descricao: atual.descricao ?? "",
          status: atual.status ?? "aberto",
          folder_id: atual.folder_id ?? "",
          capa_position: atual.capa_position ?? "center",
          banner_id: atual.banner_id ?? "",
          banner_position: atual.banner_position ?? "center right",
          auto_dias_por_data: atual.auto_dias_por_data ?? false,
          reconhecimento_facial: atual.reconhecimento_facial ?? true,
          download_liberado: atual.download_liberado ?? true,
        });
        setTags(Array.isArray(atual.tags) ? atual.tags : []);
        setDias(Array.isArray(atual.dias) ? atual.dias : []);
        setDiasOverrides(atual.dias_overrides ?? {});
      })
      .catch(() => setErro("Não foi possível carregar o evento."))
      .finally(() => setLoading(false));
  }, [id]);

  function adicionarTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags([...tags, t]);
    setTagInput("");
  }

  function adicionarDia() {
    const ultima = dias[dias.length - 1];
    const proximaData = ultima
      ? new Date(new Date(`${ultima.data}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10)
      : form.data || new Date().toISOString().slice(0, 10);
    setDias([...dias, {
      id: `dia${dias.length + 1}`,
      titulo: `Dia ${dias.length + 1}`,
      data: proximaData, folder_id: "", descricao: "", status: "disponivel",
    }]);
  }

  function atualizarDia(i: number, patch: Partial<EventoDia>) {
    setDias(dias.map((d, j) => j === i ? { ...d, ...patch } : d));
  }

  // Atualiza capa/foco de um dia. No modo automatico, grava como OVERRIDE
  // (chave = id do dia) pra sobreviver ao recalculo. No manual, edita o dia direto.
  function atualizarCapaDia(dia: EventoDia, patch: { capa_id?: string; capa_position?: string }) {
    if (form.auto_dias_por_data) {
      setDiasOverrides(prev => ({
        ...prev,
        [dia.id]: { ...prev[dia.id], ...patch },
      }));
      // Reflete na UI imediatamente (atualiza o objeto do dia em memoria)
      setDias(prev => prev.map(d => d.id === dia.id ? { ...d, ...patch } : d));
    } else {
      setDias(prev => prev.map(d => d.id === dia.id ? { ...d, ...patch } : d));
    }
  }

  async function uploadBanner(file: File) {
    setBannerErro("");
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/eventos/banner?id=${encodeURIComponent(id)}`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || `Falha (${r.status})`);
      if (!data?.banner_id) throw new Error("Resposta sem banner_id");
      setForm(f => ({ ...f, banner_id: data.banner_id }));
    } catch (e) {
      setBannerErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBannerUploading(false);
    }
  }

  async function removerBanner() {
    if (!form.banner_id) return;
    if (!confirm("Remover o banner deste evento?")) return;
    setBannerErro("");
    setBannerUploading(true);
    try {
      const r = await fetch(`/api/eventos/banner?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || `Falha (${r.status})`);
      }
      setForm(f => ({ ...f, banner_id: "" }));
    } catch (e) {
      setBannerErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBannerUploading(false);
    }
  }

  async function salvar() {
    setErro("");
    if (!form.nome || !form.data) { setErro("Preencha o nome e a data do evento."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/eventos?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome, data: form.data,
          data_fim: form.data_fim || undefined,
          local: form.local || undefined,
          categoria: form.categoria, tags,
          descricao: form.descricao, status: form.status,
          folder_id: extrairFolderId(form.folder_id),
          capa_position: form.capa_position,
          banner_id: form.banner_id || undefined,
          banner_position: form.banner_position,
          auto_dias_por_data: form.auto_dias_por_data,
          reconhecimento_facial: form.reconhecimento_facial,
          download_liberado: form.download_liberado,
          // Modo automatico: NAO persiste os dias computados (sao efemeros) — só os overrides.
          // Modo manual: persiste os dias configurados.
          dias: form.auto_dias_por_data
            ? undefined
            : (dias.length > 0 ? dias.map(d => ({ ...d, folder_id: extrairFolderId(d.folder_id) })) : undefined),
          dias_overrides: form.auto_dias_por_data
            ? (Object.keys(diasOverrides).length > 0 ? diasOverrides : undefined)
            : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Falha ao salvar evento.");
      window.location.href = "/admin/eventos";
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-[#145dff]">
        <Loader2 size={18} className="animate-spin" /> Carregando evento...
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-bold">Evento não encontrado.</p>
        <Link href="/admin/eventos" className="mt-3 inline-flex text-sm font-semibold underline">Voltar para eventos</Link>
      </div>
    );
  }

  const totalArquivos = (evento.total_fotos ?? 0) + dias.reduce((s, d) => s + (d.total_fotos ?? 0), 0);

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/eventos" className="w-11 h-11 rounded-full border border-[#c4d6f4] bg-[#f2f7ff] text-[#102658] flex items-center justify-center hover:bg-[#e7efff] transition shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[28px] font-extrabold text-[#061844] tracking-tight leading-tight">Editar evento</h1>
            <p className="text-[#415d86] text-sm mt-0.5">Atualize informações, capa, dias e permissões</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/admin/eventos/${id}/pessoas`}
            className="h-12 px-6 rounded-xl border-2 border-[#7C3AED] bg-gradient-to-br from-[#f5f0ff] to-white text-[#7C3AED] font-extrabold text-sm flex items-center gap-2 hover:shadow-md hover:bg-[#f5f0ff] transition"
          >
            <ScanFace size={16} /> Identificar pessoas
          </Link>
          <Link href="/admin/eventos" className="h-12 px-6 rounded-xl border border-[#b9cbea] bg-gradient-to-b from-[#f9fbff] to-[#edf4ff] text-[#061844] font-extrabold text-sm flex items-center hover:shadow-md transition">
            Cancelar
          </Link>
          <button onClick={salvar} disabled={saving}
            className="h-12 px-6 rounded-xl bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg hover:shadow-xl flex items-center gap-2 transition disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar evento
          </button>
        </div>
      </header>

      {erro && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
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
                <Select value={form.categoria} onChange={v => setForm({ ...form, categoria: v })}
                  options={CATEGORIAS.map(c => ({ value: c, label: c }))} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={v => setForm({ ...form, status: v })} options={[
                  { value: "aberto",    label: "🟢 Aberto" },
                  { value: "privado",   label: "🟡 Privado" },
                  { value: "encerrado", label: "⚪ Encerrado" },
                ]} />
              </Field>
              <Field label="Data inicial">
                <Input type="date" value={form.data} onChange={v => setForm({ ...form, data: v })} icon={<Calendar size={15} />} />
              </Field>
              <Field label="Data final">
                <Input type="date" min={form.data || undefined} value={form.data_fim} onChange={v => setForm({ ...form, data_fim: v })} icon={<Calendar size={15} />} />
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
                    placeholder="Adicionar tag..."
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
              <div className="sm:col-span-3">
                <Field label="Pasta principal do Google Drive">
                  <div className="flex items-center min-h-12 border border-[#bfd0ec] rounded-[10px] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] overflow-hidden">
                    <div className="w-14 flex items-center justify-center shrink-0">
                      <img src={DRIVE_LOGO} alt="Google Drive" className="w-6 h-6" />
                    </div>
                    <input
                      value={form.folder_id}
                      onChange={e => setForm({ ...form, folder_id: e.target.value })}
                      placeholder="Cole o link da pasta ou ID do Google Drive"
                      className="flex-1 min-w-0 bg-transparent text-sm text-[#061844] outline-none truncate py-3 pr-3"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* 1.5 Banner do evento (hero "Evento em andamento") */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
            <SectionHeader num="B" title="Banner do evento (hero da home)" />
            <p className="text-[#415d86] text-sm mt-1 mb-4">
              Imagem larga (flyer/arte) usada no banner <em>“Evento em andamento”</em> da home, com degradê dissolvendo na lateral esquerda. Não aparece na galeria de fotos.
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Coluna 1: upload + remover */}
              <div className="flex flex-col gap-3">
                <label className="relative inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border-2 border-dashed border-[#bfd0ec] bg-[#f7fbff] hover:border-[#145dff] hover:bg-[#eef5ff] cursor-pointer transition text-sm font-extrabold text-[#061844]">
                  {bannerUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {bannerUploading ? "Enviando..." : (form.banner_id ? "Substituir banner" : "Enviar banner")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={bannerUploading}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) uploadBanner(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.banner_id && (
                  <button
                    type="button"
                    onClick={removerBanner}
                    disabled={bannerUploading}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remover banner
                  </button>
                )}
                {bannerErro && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                    {bannerErro}
                  </div>
                )}
                {form.banner_id && (
                  <FocalPointPicker
                    fotoId={form.banner_id}
                    value={form.banner_position}
                    onChange={v => setForm({ ...form, banner_position: v })}
                    aspect="3/1"
                  />
                )}
                <p className="text-[11px] text-[#415d86]">
                  Recomendado: 1600×600 (paisagem). Max 8MB. JPG, PNG, WEBP ou GIF.
                </p>
              </div>

              {/* Coluna 2: preview com o degradê real do hero */}
              <div>
                <p className="text-xs font-extrabold text-[#061844] mb-2">Preview do hero</p>
                <div
                  className="relative aspect-[3/1] rounded-xl overflow-hidden border border-[#1F3A5F]"
                  style={{ background: "linear-gradient(135deg, #0A1A2E 0%, #102A44 100%)" }}
                >
                  {form.banner_id ? (
                    <>
                      <img
                        src={`/api/thumb?id=${form.banner_id}&sz=1200`}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: form.banner_position }}
                      />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,26,46,1) 0%, rgba(10,26,46,0.96) 28%, rgba(10,26,46,0.65) 60%, rgba(10,26,46,0.15) 100%)" }} />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(10,26,46,0.55) 0%, rgba(10,26,46,0) 30%, rgba(10,26,46,0) 70%, rgba(10,26,46,0.55) 100%)" }} />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 90% at 85% 50%, transparent 0%, rgba(10,26,46,0.35) 70%, rgba(10,26,46,0.7) 100%)" }} />
                      <div className="absolute left-4 bottom-3 text-white text-xs font-extrabold opacity-90">
                        {form.nome || "Nome do evento"}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-white/40 text-xs font-semibold gap-1.5">
                      <ImageIcon size={20} />
                      Sem banner — usa cor sólida
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Capa do evento (só se evento tem capa) */}
          {evento.capa_id && (
            <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
              <SectionHeader num="2" title="Capa do evento" />
              <div className="grid gap-5 md:grid-cols-2 mt-5">
                <FocalPointPicker
                  fotoId={evento.capa_id}
                  value={form.capa_position}
                  onChange={v => setForm({ ...form, capa_position: v })}
                  aspect="4/3"
                />
                <div>
                  <p className="text-xs font-extrabold text-[#061844] mb-2">Como vai aparecer no card</p>
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#bfd0ec] bg-[#07182f]">
                    <img
                      src={`/api/thumb?id=${evento.capa_id}&sz=600`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: form.capa_position }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/60 via-transparent to-transparent" />
                  </div>
                  <p className="text-[11px] text-[#415d86] mt-2">Preview do que aparece nos cards de evento.</p>
                </div>
              </div>
            </section>
          )}

          {/* 3. Dias do evento */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
              <SectionHeader num={evento.capa_id ? "3" : "2"} title="Dias do evento" inline />
              <button
                onClick={adicionarDia}
                disabled={form.auto_dias_por_data}
                title={form.auto_dias_por_data ? "Desligue o modo automático pra adicionar dias manuais" : undefined}
                className="h-10 px-5 rounded-[10px] bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} strokeWidth={3} /> Adicionar dia
              </button>
            </div>

            {/* Toggle: agrupar por data automaticamente */}
            <label className={`mt-2 mb-4 flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition
              ${form.auto_dias_por_data
                ? "border-[#145dff] bg-gradient-to-br from-[#eef5ff] to-white shadow-sm"
                : "border-[#dde8f7] hover:border-[#bfd0ec] hover:bg-[#f7fbff]"}`}>
              <input
                type="checkbox"
                checked={form.auto_dias_por_data}
                onChange={e => setForm({ ...form, auto_dias_por_data: e.target.checked })}
                className="mt-0.5 h-5 w-5 rounded accent-[#145dff] shrink-0"
              />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#061844]">
                  ✨ Agrupar fotos por data automaticamente
                </div>
                <p className="text-xs text-[#415d86] mt-0.5 leading-relaxed">
                  Joga TODAS as fotos na pasta principal e o sistema separa os dias pela
                  data de captura (EXIF) ou criação. Não precisa criar subpastas manualmente.
                  <strong className="text-[#145dff]"> Recomendado pra eventos multi-dia.</strong>
                </p>
              </div>
            </label>

            <p className="text-[#415d86] text-sm mt-1 mb-4">
              {form.auto_dias_por_data
                ? "Modo automático ligado — todas as fotos devem estar na PASTA PRINCIPAL do evento (não em subpastas de dia)."
                : dias.length === 0
                  ? "Evento de 1 dia. Adicione dias se for multi-dia — cada dia tem sua própria pasta no Drive."
                  : `${dias.length} dia(s) configurado(s).`}
            </p>

            {/* Diagnóstico do auto-dia */}
            {form.auto_dias_por_data && (
              <div className="mb-4 rounded-xl border border-[#dde8f7] bg-[#f7fbff] p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-extrabold text-[#061844]">🔍 Diagnóstico da separação por data</span>
                  <button
                    type="button"
                    onClick={carregarDiasPreview}
                    disabled={previewLoading}
                    className="h-8 px-3 rounded-lg bg-[#145dff] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {previewLoading ? "Lendo fotos..." : "Testar agora"}
                  </button>
                </div>

                {!diasPreview && !previewLoading && (
                  <p className="text-[11px] text-[#415d86]">
                    Clique em <strong>Testar agora</strong> pra ver como as fotos da pasta principal serão separadas.
                  </p>
                )}

                {diasPreview?.error && (
                  <p className="text-[11px] text-red-600">Erro: {diasPreview.error}</p>
                )}

                {diasPreview?.semPasta && (
                  <p className="text-[11px] text-amber-700">
                    ⚠️ O evento não tem pasta principal configurada. Configure o folder_id acima.
                  </p>
                )}

                {diasPreview && !diasPreview.error && !diasPreview.semPasta && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-1 rounded-md bg-white border border-[#dde8f7] font-semibold text-[#061844]">
                        {diasPreview.totalFotos} fotos na pasta
                      </span>
                      <span className={`px-2 py-1 rounded-md border font-semibold ${
                        diasPreview.diasDetectados > 1
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                        {diasPreview.diasDetectados} dia(s) detectado(s)
                      </span>
                      {diasPreview.porExif > 0 && (
                        <span className="px-2 py-1 rounded-md bg-white border border-[#dde8f7] text-[#415d86]">
                          {diasPreview.porExif} via EXIF
                        </span>
                      )}
                      {diasPreview.porCreatedTime > 0 && (
                        <span className="px-2 py-1 rounded-md bg-white border border-[#dde8f7] text-[#415d86]">
                          {diasPreview.porCreatedTime} via data de upload
                        </span>
                      )}
                      {diasPreview.foraPeriodo > 0 && (
                        <span className="px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-600">
                          {diasPreview.foraPeriodo} fora do período
                        </span>
                      )}
                      {diasPreview.semData > 0 && (
                        <span className="px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-600">
                          {diasPreview.semData} sem data
                        </span>
                      )}
                    </div>

                    {diasPreview.dias.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {diasPreview.dias.map(d => (
                          <span key={d.data} className="px-2 py-1 rounded-md bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white text-[11px] font-bold">
                            Dia {d.ordem}: {d.data.split("-").reverse().slice(0, 2).join("/")} ({d.total})
                          </span>
                        ))}
                      </div>
                    )}

                    {diasPreview.diasDetectados <= 1 && diasPreview.totalFotos > 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-relaxed">
                        ⚠️ Todas as fotos caíram em <strong>um único dia</strong>. Causas comuns:
                        (1) as fotos não têm EXIF e foram enviadas todas no mesmo dia (data de upload igual);
                        (2) o período do evento (data início/fim) está errado e está cortando datas;
                        (3) as fotos estão em <strong>subpastas de dia</strong> em vez da pasta principal.
                      </p>
                    )}
                    {diasPreview.totalFotos === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                        ⚠️ Nenhuma foto na pasta principal. No modo automático, todas as fotos devem ficar
                        direto na pasta principal do evento — não em subpastas.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {dias.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dias.map((dia, i) => (
                  <DiaCardEdit key={`${dia.id}-${i}`} dia={dia} ordem={i + 1}
                    onChange={p => atualizarDia(i, p)}
                    onRemove={() => setDias(dias.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {/* Capa e foco dos dias */}
            {dias.length > 0 && (
              <div className="mt-6 border-t border-[#dde8f7] pt-5">
                <h3 className="mb-3 text-sm font-extrabold text-[#061844]">Capa e foco dos dias</h3>
                <div className="grid gap-4">
                  {dias.map((dia, i) => (
                    <div key={`${dia.id}-capa`} className="rounded-2xl border border-[#bfd0ec] bg-gradient-to-b from-white to-[#f5f9ff] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-[#061844]">{dia.titulo || `Dia ${i + 1}`}</p>
                          <p className="text-xs text-[#415d86]">Escolha a foto da capa e ajuste o foco.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCapaPickerDia(dia)}
                          className="rounded-lg bg-gradient-to-br from-[#145dff] to-[#074ee6] px-3 py-1.5 text-[11px] font-extrabold text-white inline-flex items-center gap-1.5 hover:shadow-md transition"
                        >
                          <ImageIcon size={12} /> {dia.capa_id ? "Trocar capa" : "Escolher capa"}
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {dia.capa_id ? (
                          <FocalPointPicker
                            fotoId={dia.capa_id}
                            value={dia.capa_position ?? "center"}
                            onChange={v => atualizarCapaDia(dia, { capa_position: v })}
                            aspect="16/10"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCapaPickerDia(dia)}
                            className="aspect-[16/10] rounded-xl border-2 border-dashed border-[#bfd0ec] bg-[#f7fbff] grid place-items-center text-[#145dff] text-xs font-bold hover:bg-[#eef5ff] transition gap-1"
                          >
                            <ImageIcon size={20} />
                            Escolher capa deste dia
                          </button>
                        )}
                        <div>
                          <p className="mb-2 text-xs font-extrabold text-[#061844]">Preview do dia</p>
                          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[#bfd0ec] bg-[#07182f]">
                            {dia.capa_id && (
                              <img
                                src={`/api/thumb?id=${dia.capa_id}&sz=600`}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                style={{ objectPosition: dia.capa_position ?? "center" }}
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/60 via-transparent to-transparent" />
                            <span className="absolute bottom-3 left-3 rounded-full bg-gradient-to-r from-[#145dff] to-[#7d3cff] px-2.5 py-1 text-xs font-bold text-white shadow">
                              {dia.titulo || `Dia ${i + 1}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 4. Permissões */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-7">
            <SectionHeader num={evento.capa_id ? "4" : "3"} title="Permissões" />
            <div className="space-y-3 mt-5">
              <ToggleRow label="Reconhecimento facial" hint="Permite que usuários encontrem suas fotos via selfie"
                value={form.reconhecimento_facial}
                onClick={() => setForm({ ...form, reconhecimento_facial: !form.reconhecimento_facial })} />
              <ToggleRow label="Download liberado" hint="Usuários podem baixar suas fotos em alta resolução"
                value={form.download_liberado}
                onClick={() => setForm({ ...form, download_liberado: !form.download_liberado })} />
            </div>
          </section>
        </div>

        {/* ─── COLUNA SIDEBAR (RESUMO) ─── */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start min-w-0">
          {/* Resumo */}
          <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-6">
            <h3 className="flex items-center gap-3 font-extrabold text-lg text-[#061844] mb-4">
              <Sparkles size={22} className="text-[#145dff]" /> Resumo do evento
            </h3>

            <div className="grid grid-cols-[72px_1fr] gap-4 items-center px-5 py-5 bg-gradient-to-b from-white to-[#f4f8ff] rounded-2xl mb-4">
              {evento.capa_id ? (
                <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden shadow-[0_16px_26px_rgba(20,93,255,.24)]">
                  <img src={`/api/thumb?id=${evento.capa_id}&sz=200`} alt="" className="w-full h-full object-cover"
                    style={{ objectPosition: form.capa_position }} />
                </div>
              ) : (
                <div className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center text-white bg-gradient-to-br from-[#3d8cff] to-[#145dff] shadow-[0_16px_26px_rgba(20,93,255,.24)]">
                  <Calendar size={32} strokeWidth={2.5} />
                </div>
              )}
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
                  {ehMultiDia && form.data_fim && (<><span className="text-gray-400">até</span><span>{fmtData(form.data_fim)}</span></>)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <MiniCard tone="blue"
                icon={<Calendar size={20} className="text-[#145dff]" />}
                valor={`${totalDias} dia${totalDias > 1 ? "s" : ""}`}
                label="de evento" />
              <MiniCard tone="green"
                icon={dias.length > 0
                  ? <Folder size={20} className="text-[#7d3cff]" />
                  : <img src={DRIVE_LOGO} alt="" className="w-5 h-5" />}
                valor={dias.length > 0 ? "Pasta por dia" : "Pasta única"}
                label={dias.length > 0 ? `${dias.filter(d => d.folder_id).length}/${dias.length} configuradas` : "para todo evento"} />
              <MiniCard tone="purple"
                icon={<FileText size={20} className="text-[#7d3cff]" />}
                valor={totalArquivos.toLocaleString("pt-BR")}
                label="arquivos encontrados" />
              <MiniCard
                tone={statusFinal.tone === "ok" ? "green" : statusFinal.tone === "warn" ? "orange" : "blue"}
                icon={statusFinal.tone === "ok"
                  ? <CheckCircle size={20} className="text-[#20b75a]" />
                  : statusFinal.tone === "warn"
                    ? <AlertCircle size={20} className="text-[#ff8a1f]" />
                    : <Clock size={20} className="text-[#145dff]" />}
                valor={statusFinal.label}
                label={statusFinal.detalhe} />
            </div>
          </section>

          {/* Timeline dos dias */}
          {dias.length > 0 && (
            <section className="bg-white/95 backdrop-blur-md border border-[#b6cbec]/80 rounded-[18px] shadow-[0_14px_36px_rgba(8,39,93,.13)] p-6">
              <h3 className="font-extrabold text-lg text-[#061844] mb-2">Dias do evento</h3>
              <div className="pt-2">
                {dias.map((d, i) => {
                  const pastaOk = !!extrairFolderId(d.folder_id);
                  const isLast = i === dias.length - 1;
                  return (
                    <div key={`${d.id}-${i}`} className="relative grid grid-cols-[39px_1fr_auto] gap-4 min-h-[76px] items-start">
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
                Mudanças só são aplicadas ao clicar em <b>Salvar evento</b>. Os usuários veem o evento atualizado em até 5 min.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* Modal seletor de capa do dia */}
      {capaPickerDia && (
        <CapaPickerModal
          dia={capaPickerDia}
          autoMode={form.auto_dias_por_data}
          onClose={() => setCapaPickerDia(null)}
          onPick={(fotoId) => {
            atualizarCapaDia(capaPickerDia, { capa_id: fotoId });
            setCapaPickerDia(null);
          }}
        />
      )}
    </div>
  );
}

/* ──────────────── Componentes ──────────────── */

/** Modal pra escolher a foto de capa de um dia. No modo auto filtra a pasta
 *  principal por data; no manual lista a pasta do dia. */
function CapaPickerModal({ dia, autoMode, onClose, onPick }: {
  dia: EventoDia;
  autoMode: boolean;
  onClose: () => void;
  onPick: (fotoId: string) => void;
}) {
  const [fotos, setFotos] = useState<{ id: string; name: string; data?: string | null }[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      try {
        const r = await fetch(`/api/fotos?folderId=${encodeURIComponent(dia.folder_id)}`, { cache: "no-store" });
        const data = await r.json();
        let lista: { id: string; name: string; data?: string | null }[] = Array.isArray(data?.fotos) ? data.fotos : [];
        // Modo auto: o dia compartilha a pasta principal — filtra pela data do dia (id "dia-YYYY-MM-DD")
        if (autoMode && dia.id.startsWith("dia-")) {
          const alvo = dia.id.replace(/^dia-/, "");
          lista = lista.filter(f => f.data === alvo);
        }
        if (!cancel) setFotos(lista);
      } catch {
        if (!cancel) setFotos([]);
      } finally {
        if (!cancel) setCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [dia, autoMode]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-extrabold text-[#061844] text-base">Escolher capa — {dia.titulo}</h3>
            <p className="text-xs text-[#415d86] mt-0.5">
              {carregando ? "Carregando fotos…" : `${fotos.length} foto(s) — clique numa pra usar como capa`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {carregando ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#415d86]">
              <Loader2 size={20} className="animate-spin" /> Carregando…
            </div>
          ) : fotos.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">Nenhuma foto encontrada pra este dia.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {fotos.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPick(f.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition hover:scale-105 ${
                    f.id === dia.capa_id ? "border-[#145dff] ring-2 ring-[#145dff]/40" : "border-transparent hover:border-[#145dff]/50"}`}
                >
                  <img src={`/api/thumb?id=${f.id}&sz=200`} alt="" className="absolute inset-0 w-full h-full object-cover bg-gray-100" loading="lazy" />
                  {f.id === dia.capa_id && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#145dff] text-white flex items-center justify-center">
                      <CheckCircle size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ num, title, inline }: { num: string; title: string; inline?: boolean }) {
  return (
    <div className={`flex items-center gap-3.5 ${inline ? "" : "mb-1"}`}>
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

function ToggleRow({ label, hint, value, onClick }: { label: string; hint?: string; value: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center justify-between rounded-[10px] border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] px-4 py-3 text-left transition hover:border-[#145dff]">
      <div className="min-w-0">
        <span className="block text-sm font-extrabold text-[#061844]">{label}</span>
        {hint && <span className="block text-xs text-[#415d86] mt-0.5">{hint}</span>}
      </div>
      {value
        ? <ToggleRight size={36} className="text-[#145dff] shrink-0" strokeWidth={1.8} />
        : <ToggleLeft  size={36} className="text-gray-300 shrink-0"  strokeWidth={1.8} />}
    </button>
  );
}

function DiaCardEdit({ dia, ordem, onChange, onRemove }: {
  dia: EventoDia; ordem: number;
  onChange: (p: Partial<EventoDia>) => void;
  onRemove: () => void;
}) {
  const pastaOk = !!extrairFolderId(dia.folder_id ?? "");
  return (
    <div className="border border-[#c9d7ec] rounded-xl p-3.5 bg-gradient-to-b from-white to-[#f8fbff]">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex h-7 px-4 items-center justify-center rounded-full bg-[#dceaff] text-[#145dff] font-extrabold text-sm">
          Dia {ordem}
        </span>
        <div className="flex items-center gap-1.5 text-[#061844] text-sm">
          <Calendar size={13} className="text-[#145dff]" />
          <input type="date"
            value={dia.data?.slice(0, 10) ?? ""}
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
        value={dia.descricao ?? ""}
        onChange={e => onChange({ descricao: e.target.value })}
        placeholder="Descrição (opcional)"
        className="w-full h-10 px-3 mb-2 border border-[#cbd7ea] rounded-lg bg-gradient-to-b from-white to-[#f7fbff] text-sm text-[#3f587e] outline-none focus:border-[#145dff]"
      />

      <div className="relative">
        <Folder size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7d3cff]" />
        <input
          value={dia.folder_id ?? ""}
          onChange={e => onChange({ folder_id: e.target.value })}
          placeholder="Link da pasta no Drive"
          className={`w-full h-10 pl-8 pr-3 rounded-lg border bg-white text-xs text-[#061844] outline-none
            ${pastaOk ? "border-emerald-400" : "border-[#cbd7ea] focus:border-[#145dff]"}`}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-extrabold border
          ${pastaOk ? "bg-[#ddf7e8] text-[#047a32] border-[#c0efcf]" : "bg-[#fff0df] text-[#a04d00] border-[#ffd8b5]"}`}>
          {pastaOk ? <><CheckCircle size={11} strokeWidth={3} /> Pronto</> : <><Clock size={11} /> Aguardando</>}
        </span>
        <button onClick={onRemove}
          className="flex items-center gap-1 h-7 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-extrabold transition">
          <Trash2 size={12} /> Remover
        </button>
      </div>
    </div>
  );
}
