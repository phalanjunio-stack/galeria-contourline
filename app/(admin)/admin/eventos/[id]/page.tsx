"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Calendar, MapPin, Save, Loader2, Plus, X,
  Folder, Clock, CheckCircle, FileText, Sparkles,
  ChevronDown, Trash2, ToggleLeft, ToggleRight,
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
    reconhecimento_facial: true, download_liberado: true,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dias, setDias] = useState<EventoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [erro,    setErro]    = useState("");

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
          reconhecimento_facial: atual.reconhecimento_facial ?? true,
          download_liberado: atual.download_liberado ?? true,
        });
        setTags(Array.isArray(atual.tags) ? atual.tags : []);
        setDias(Array.isArray(atual.dias) ? atual.dias : []);
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
          reconhecimento_facial: form.reconhecimento_facial,
          download_liberado: form.download_liberado,
          dias: dias.length > 0
            ? dias.map(d => ({ ...d, folder_id: extrairFolderId(d.folder_id) }))
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
        <div className="flex gap-3">
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
              <button onClick={adicionarDia}
                className="h-10 px-5 rounded-[10px] bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg inline-flex items-center gap-1.5">
                <Plus size={14} strokeWidth={3} /> Adicionar dia
              </button>
            </div>
            <p className="text-[#415d86] text-sm mt-1 mb-4">
              {dias.length === 0
                ? "Evento de 1 dia. Adicione dias se for multi-dia — cada dia tem sua própria pasta no Drive."
                : `${dias.length} dia(s) configurado(s).`}
            </p>

            {dias.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dias.map((dia, i) => (
                  <DiaCardEdit key={`${dia.id}-${i}`} dia={dia} ordem={i + 1}
                    onChange={p => atualizarDia(i, p)}
                    onRemove={() => setDias(dias.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {/* Capa dos dias (focal point) */}
            {dias.some(d => d.capa_id) && (
              <div className="mt-6 border-t border-[#dde8f7] pt-5">
                <h3 className="mb-3 text-sm font-extrabold text-[#061844]">Capa e foco dos dias</h3>
                <div className="grid gap-4">
                  {dias.map((dia, i) => dia.capa_id ? (
                    <div key={`${dia.id}-capa`} className="rounded-2xl border border-[#bfd0ec] bg-gradient-to-b from-white to-[#f5f9ff] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-[#061844]">{dia.titulo || `Dia ${i + 1}`}</p>
                          <p className="text-xs text-[#415d86]">Ajusta o card deste dia.</p>
                        </div>
                        <span className="rounded-full bg-[#dceaff] px-3 py-1 text-[11px] font-extrabold text-[#145dff]">Dia {i + 1}</span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FocalPointPicker
                          fotoId={dia.capa_id}
                          value={dia.capa_position ?? "center"}
                          onChange={v => atualizarDia(i, { capa_position: v })}
                          aspect="16/10"
                        />
                        <div>
                          <p className="mb-2 text-xs font-extrabold text-[#061844]">Preview do dia</p>
                          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[#bfd0ec] bg-[#07182f]">
                            <img
                              src={`/api/thumb?id=${dia.capa_id}&sz=600`}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              style={{ objectPosition: dia.capa_position ?? "center" }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B4E]/60 via-transparent to-transparent" />
                            <span className="absolute bottom-3 left-3 rounded-full bg-gradient-to-r from-[#145dff] to-[#7d3cff] px-2.5 py-1 text-xs font-bold text-white shadow">
                              Dia {i + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null)}
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
    </div>
  );
}

/* ──────────────── Componentes ──────────────── */

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
