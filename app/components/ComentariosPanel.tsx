"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Heart, Clock, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { playSound } from "@/lib/sounds";
import type { Comentario } from "@/app/api/comentarios/route";

interface Props {
  eventoId:   string;
  eventoNome: string;
}

type Vista = "lista" | "form" | "enviado";

const STORAGE_USER = "usuario_simples";

export default function ComentariosPanel({ eventoId, eventoNome }: Props) {
  const { data: session } = useSession();
  const [aberto,      setAberto]      = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [carregando,  setCarregando]  = useState(true);
  const [vista,       setVista]       = useState<Vista>("lista");
  const [enviando,    setEnviando]    = useState(false);
  const [erro,        setErro]        = useState("");

  // Form
  const [nome,     setNome]     = useState("");
  const [email,    setEmail]    = useState("");
  const [mensagem, setMensagem] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);

  // Carrega usuário salvo
  useEffect(() => {
    if (session?.user) {
      setNome(session.user.name ?? "");
      setEmail(session.user.email ?? "");
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.nome)  setNome(u.nome);
        if (u?.email) setEmail(u.email);
      }
    } catch {}
  }, [session]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/comentarios?eventoId=${encodeURIComponent(eventoId)}`, { cache: "no-store" });
      if (r.ok) setComentarios(await r.json());
    } catch {}
    setCarregando(false);
  }, [eventoId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Atalho ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setAberto(false); }
    if (aberto) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  function abrir() {
    if (aberto) return;
    setAberto(true);
    try { playSound("open"); } catch {}
  }
  function fechar() {
    setAberto(false);
    setErro("");
    try { playSound("close"); } catch {}
  }

  async function enviar() {
    setErro("");
    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
      setErro("Preencha nome, email e mensagem.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId,
          autor_nome: nome.trim(),
          autor_email: email.trim(),
          mensagem: mensagem.trim(),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error ?? "Falha ao enviar comentário");
      }
      setMensagem("");
      setVista("enviado");
      playSound("ding");
      // Salva nome+email pra próxima
      try {
        const raw = localStorage.getItem(STORAGE_USER);
        const u = raw ? JSON.parse(raw) : {};
        localStorage.setItem(STORAGE_USER, JSON.stringify({ ...u, nome, email }));
      } catch {}
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function curtir(c: Comentario) {
    if (!email.trim()) {
      setVista("form");
      setErro("Identifique-se (nome + email) pra curtir.");
      return;
    }
    // Otimista
    const jaCurti = c.likes.includes(email.toLowerCase());
    setComentarios(prev => prev.map(x => x.id === c.id
      ? { ...x, likes: jaCurti ? x.likes.filter(e => e !== email.toLowerCase()) : [...x.likes, email.toLowerCase()] }
      : x));
    playSound("snap");
    try {
      await fetch(`/api/comentarios?id=${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, toggleLike: true, email: email.trim() }),
      });
    } catch {
      // reverte se falhar
      carregar();
    }
  }

  const totalAprovados = comentarios.length; // GET já filtra aprovados pro público

  return (
    <>
      {/* ─── Desktop: aba lateral fixa direita (hover abre) ─── */}
      <div className="hidden lg:block fixed top-1/2 -translate-y-1/2 right-0 z-40">
        <button
          onClick={() => aberto ? fechar() : abrir()}
          aria-label={`Comentários (${totalAprovados})`}
          className="group flex items-center gap-2 rounded-l-2xl bg-gradient-to-br from-[#145dff] to-[#7d3cff] text-white pl-3 pr-2 py-4 shadow-[0_10px_25px_rgba(124,58,237,.35)] hover:pl-4 transition-all"
          style={{ writingMode: "horizontal-tb" }}
        >
          <MessageCircle size={18} />
          {totalAprovados > 0 && (
            <span className="text-[11px] font-extrabold bg-white/25 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {totalAprovados}
            </span>
          )}
          <span className="text-xs font-extrabold hidden xl:inline">Comentários</span>
        </button>
      </div>

      {/* ─── Mobile: FAB no canto inferior direito ─── */}
      <button
        onClick={abrir}
        aria-label={`Comentários (${totalAprovados})`}
        className="lg:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[#145dff] to-[#7d3cff] text-white shadow-[0_10px_30px_rgba(124,58,237,.45)] flex items-center justify-center active:scale-95 transition"
      >
        <MessageCircle size={22} />
        {totalAprovados > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
            {totalAprovados > 9 ? "9+" : totalAprovados}
          </span>
        )}
      </button>

      {/* ─── Overlay (mobile + desktop) ─── */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:bg-black/10"
          onClick={fechar}
        />
      )}

      {/* ─── Painel principal ─── */}
      <aside
        ref={panelRef}
        className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out
          /* Mobile: bottom sheet 85vh */
          inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl
          /* Desktop: sidebar direita (sobrescreve inset/max-h) */
          lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:h-full lg:max-h-none lg:w-[420px] lg:border-l lg:border-[#dde8f7] lg:rounded-none
          ${aberto ? "translate-y-0 lg:translate-y-0 lg:translate-x-0 pointer-events-auto" : "translate-y-full lg:translate-y-0 lg:translate-x-full pointer-events-none"}`}
        aria-hidden={!aberto}
      >
        {/* Grip mobile */}
        <div className="lg:hidden mx-auto mt-2 mb-1 w-12 h-1.5 rounded-full bg-gray-300" />

        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#dde8f7] bg-gradient-to-r from-[#f4f8ff] to-white">
          <div className="min-w-0">
            <h3 className="font-extrabold text-[#061844] text-base flex items-center gap-2">
              <MessageCircle size={18} className="text-[#145dff]" />
              Comentários
            </h3>
            <p className="text-xs text-[#415d86] truncate">{eventoNome}</p>
          </div>
          <button onClick={fechar} aria-label="Fechar"
            className="w-9 h-9 rounded-xl hover:bg-[#eef5ff] text-[#415d86] flex items-center justify-center transition">
            <X size={18} />
          </button>
        </header>

        {/* Tabs/CTA pra abrir form */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#dde8f7]">
          <button
            onClick={() => setVista("lista")}
            className={`flex-1 h-9 rounded-lg text-xs font-extrabold transition
              ${vista === "lista" ? "bg-[#145dff] text-white shadow" : "text-[#061844] hover:bg-[#eef5ff]"}`}
          >
            Ver ({totalAprovados})
          </button>
          <button
            onClick={() => { setVista("form"); setErro(""); }}
            className={`flex-1 h-9 rounded-lg text-xs font-extrabold transition
              ${vista === "form" ? "bg-[#145dff] text-white shadow" : "border border-[#bfd0ec] text-[#061844] hover:bg-[#eef5ff]"}`}
          >
            Escrever
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {vista === "lista" && (
            <>
              {carregando ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : comentarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageCircle size={36} className="text-gray-200 mb-2" />
                  <p className="font-extrabold text-[#061844] text-sm">Seja o primeiro a comentar</p>
                  <p className="text-xs text-[#415d86] mt-1">Os comentários passam por moderação rápida do admin antes de aparecer.</p>
                  <button
                    onClick={() => { setVista("form"); setErro(""); }}
                    className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white text-xs font-extrabold shadow">
                    <Send size={13} /> Escrever comentário
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {comentarios.map(c => (
                    <ComentarioCard
                      key={c.id}
                      c={c}
                      meuEmail={email.trim().toLowerCase()}
                      onCurtir={() => curtir(c)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {vista === "form" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>Seu comentário só aparece depois que o admin aprovar. Costuma ser rápido.</span>
              </div>

              <Field label="Seu nome">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Como quer ser identificado"
                  className="w-full h-11 px-3 rounded-lg border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-sm text-[#061844] outline-none focus:border-[#145dff]"
                />
              </Field>
              <Field label="Email (não aparece pra outros)">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-11 px-3 rounded-lg border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-sm text-[#061844] outline-none focus:border-[#145dff]"
                />
              </Field>
              <Field label="Mensagem">
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder="Conta o que achou do evento..."
                  rows={5}
                  maxLength={2000}
                  className="w-full px-3 py-2 rounded-lg border border-[#bfd0ec] bg-gradient-to-b from-[#f7fbff] to-[#eef5ff] text-sm text-[#061844] outline-none focus:border-[#145dff] resize-none leading-snug"
                />
                <p className="mt-1 text-[10px] text-[#415d86] text-right">{mensagem.length}/2000</p>
              </Field>

              {erro && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {erro}
                </div>
              )}

              <button
                onClick={enviar}
                disabled={enviando || !nome.trim() || !email.trim() || !mensagem.trim()}
                className="w-full h-12 rounded-xl bg-gradient-to-br from-[#145dff] to-[#074ee6] text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-xl transition"
              >
                <Send size={15} /> {enviando ? "Enviando..." : "Enviar pra moderação"}
              </button>
            </div>
          )}

          {vista === "enviado" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <p className="font-extrabold text-[#061844] text-base">Comentário enviado!</p>
              <p className="text-xs text-[#415d86] mt-2 max-w-xs">
                Tá na fila de moderação. Vai aparecer aqui pra todo mundo assim que o admin aprovar.
              </p>
              <button
                onClick={() => { setVista("lista"); carregar(); }}
                className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-[#bfd0ec] text-[#061844] text-xs font-extrabold hover:bg-[#eef5ff]">
                <ChevronRight size={13} /> Ver outros comentários
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ─────────────────────────── Sub-componentes ─────────────────────────── */

function ComentarioCard({ c, meuEmail, onCurtir }: { c: Comentario; meuEmail: string; onCurtir: () => void }) {
  const curtido = meuEmail && c.likes.includes(meuEmail);
  return (
    <div className="rounded-xl border border-[#dde8f7] bg-gradient-to-b from-white to-[#f8fbff] p-3.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#145dff] to-[#7d3cff] text-white font-black flex items-center justify-center shrink-0 text-sm">
          {(c.autor_nome[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <strong className="text-sm font-extrabold text-[#061844] truncate">{c.autor_nome}</strong>
            <span className="text-[10px] text-[#415d86] shrink-0">{tempoRelativo(c.criado_em)}</span>
          </div>
          <p className="mt-1 text-sm text-[#15315c] leading-snug whitespace-pre-wrap break-words">{c.mensagem}</p>

          <button
            onClick={onCurtir}
            className={`mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-extrabold transition
              ${curtido ? "bg-pink-50 text-pink-600" : "text-[#415d86] hover:bg-[#eef5ff]"}`}
          >
            <Heart size={12} fill={curtido ? "currentColor" : "none"} />
            {c.likes.length > 0 ? c.likes.length : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[11px] font-extrabold text-[#061844]">{label}</span>
      {children}
    </label>
  );
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const h   = Math.floor(diff / 3600000);
  const d   = Math.floor(diff / 86400000);
  if (min < 2)  return "agora";
  if (min < 60) return `há ${min}min`;
  if (h   < 24) return `há ${h}h`;
  if (d   < 7)  return `há ${d}d`;
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return ""; }
}
