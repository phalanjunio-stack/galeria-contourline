"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  HardDrive,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { EventoItem } from "@/app/api/eventos/route";

const CATEGORIAS_EVENTO = [
  "Evento",
  "Congresso",
  "Treinamento",
  "Corporativo",
  "Workshop",
  "Palestra",
  "Confraternizacao",
  "Outros",
];

function extrairFolderId(value: string) {
  const folderLink = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return folderLink?.[1] ?? value.trim();
}

export default function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [evento, setEvento] = useState<EventoItem | null>(null);
  const [form, setForm] = useState({
    nome: "",
    data: "",
    categoria: "Evento",
    tags: "",
    descricao: "",
    status: "aberto",
    folder_id: "",
    reconhecimento_facial: true,
    download_liberado: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetch("/api/eventos")
        .then((res) => res.json())
        .then((eventos: EventoItem[]) => {
          const atual = Array.isArray(eventos) ? eventos.find((item) => item.id === id) ?? null : null;
          setEvento(atual);
          if (!atual) return;
          setForm({
            nome: atual.nome ?? "",
            data: atual.data?.slice(0, 10) ?? "",
            categoria: atual.categoria ?? "Evento",
            tags: Array.isArray(atual.tags) ? atual.tags.join(", ") : "",
            descricao: atual.descricao ?? "",
            status: atual.status ?? "aberto",
            folder_id: atual.folder_id ?? "",
            reconhecimento_facial: atual.reconhecimento_facial ?? true,
            download_liberado: atual.download_liberado ?? true,
          });
        })
        .catch(() => setErro("Nao foi possivel carregar o evento."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [id]);

  async function salvar() {
    if (!form.nome || !form.data) {
      setErro("Preencha o nome e a data do evento.");
      return;
    }

    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`/api/eventos?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          data: form.data,
          categoria: form.categoria,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          descricao: form.descricao,
          status: form.status,
          folder_id: extrairFolderId(form.folder_id),
          reconhecimento_facial: form.reconhecimento_facial,
          download_liberado: form.download_liberado,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Falha ao salvar evento.");
      window.location.href = "/admin/eventos";
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-[#2E7DD1]">
        <Loader2 size={18} className="animate-spin" />
        Carregando evento...
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-bold">Evento nao encontrado.</p>
        <Link href="/admin/eventos" className="mt-3 inline-flex text-sm font-semibold underline">Voltar para eventos</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <header className="flex items-start gap-3">
        <Link href="/admin/eventos" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-[#EFF5FF] hover:text-[#2E7DD1]">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E]">Editar evento</h1>
          <p className="text-sm text-gray-500">Categoria e tags alimentam os filtros da galeria.</p>
        </div>
      </header>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 font-bold text-[#0D2B4E]">
          <Camera size={17} className="text-[#2E7DD1]" />
          Informacoes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="admin-event-input" />
          </Field>
          <Field label="Data">
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="admin-event-input pl-9" />
            </div>
          </Field>
          <Field label="Categoria">
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="admin-event-input">
              {CATEGORIAS_EVENTO.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </Field>
          <Field label="Tags">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Ex: saude, equipe, anual" className="admin-event-input" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="admin-event-input">
              <option value="aberto">Aberto</option>
              <option value="privado">Privado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </Field>
          <Field label="Pasta Drive">
            <div className="relative">
              <HardDrive size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E7DD1]" />
              <input value={form.folder_id} onChange={(e) => setForm({ ...form, folder_id: e.target.value })} placeholder="Link da pasta ou folder ID" className="admin-event-input pl-9" />
            </div>
          </Field>
        </div>
        <Field label="Descricao" block>
          <textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="admin-event-input resize-none" />
        </Field>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-[#0D2B4E]">Permissoes</h2>
        <div className="space-y-3">
          <Toggle label="Reconhecimento facial" value={form.reconhecimento_facial} onClick={() => setForm({ ...form, reconhecimento_facial: !form.reconhecimento_facial })} />
          <Toggle label="Download liberado" value={form.download_liberado} onClick={() => setForm({ ...form, download_liberado: !form.download_liberado })} />
        </div>
      </section>

      <div className="flex gap-3">
        <Link href="/admin/eventos" className="flex-1 rounded-xl border-2 border-gray-200 py-3.5 text-center text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
          Cancelar
        </Link>
        <button onClick={salvar} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2167AE] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#19558F] disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>

      <style jsx global>{`
        .admin-event-input {
          width: 100%;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.75rem;
          background: #eff5ff;
          padding: 0.75rem 1rem;
          color: #0d2b4e;
          font-size: 0.875rem;
          outline: none;
        }
        .admin-event-input:focus {
          border-color: #2e7dd1;
          box-shadow: 0 0 0 2px rgb(46 125 209 / 0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, block = false }: { label: string; children: React.ReactNode; block?: boolean }) {
  return (
    <label className={`block ${block ? "mt-4" : ""}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#1A4A80]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-xl border border-[#2E7DD1]/10 bg-[#EFF5FF] p-4 text-left">
      <span className="text-sm font-semibold text-[#0D2B4E]">{label}</span>
      {value
        ? <><CheckCircle size={14} className="mr-1 text-emerald-600" /><ToggleRight size={31} className="text-[#2E7DD1]" /></>
        : <ToggleLeft size={31} className="text-gray-300" />}
    </button>
  );
}
