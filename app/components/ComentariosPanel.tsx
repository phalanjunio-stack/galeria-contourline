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
    try { playSound("chatOpen"); } catch {}
  }
  function fechar() {
    setAberto(false);
    setErro("");
    try { playSound("chatClose"); } catch {}
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
      {/* ─── FAB orb azul (desktop + mobile) ─── */}
      <div className="fixed z-40 bottom-24 right-5 lg:bottom-8 lg:right-6">
        <div className="cfab-wrap">
          <span className="cfab-aura" />
          <span className="cfab-halo" />
          <span className="cfab-spark" style={{ ["--ang" as string]: "30deg",  ["--d" as string]: "1.8s", ["--del" as string]: "0s"   } as React.CSSProperties} />
          <span className="cfab-spark" style={{ ["--ang" as string]: "100deg", ["--d" as string]: "2.2s", ["--del" as string]: ".35s" } as React.CSSProperties} />
          <span className="cfab-spark" style={{ ["--ang" as string]: "175deg", ["--d" as string]: "1.6s", ["--del" as string]: ".7s"  } as React.CSSProperties} />
          <span className="cfab-spark" style={{ ["--ang" as string]: "250deg", ["--d" as string]: "2.0s", ["--del" as string]: ".15s" } as React.CSSProperties} />
          <span className="cfab-spark" style={{ ["--ang" as string]: "320deg", ["--d" as string]: "1.9s", ["--del" as string]: ".55s" } as React.CSSProperties} />
          <button
            type="button"
            onClick={() => aberto ? fechar() : abrir()}
            aria-label={`Comentários (${totalAprovados})`}
            className="cfab-orb"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {totalAprovados > 0 && (
              <span className="cfab-badge">{totalAprovados > 9 ? "9+" : totalAprovados}</span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Overlay leve (clica fora pra fechar; transparente no desktop) ─── */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent"
          onClick={fechar}
        />
      )}

      {/* ─── Painel principal ─── */}
      <aside
        ref={panelRef}
        className={`cfab-panel fixed z-50 bg-white shadow-2xl flex flex-col border border-[#dde8f7]
          /* Mobile: bottom sheet acima do FAB */
          inset-x-3 bottom-44 max-h-[72vh] rounded-3xl
          /* Desktop: popup flutuante ancorado acima do FAB (canto inferior direito) */
          lg:inset-auto lg:left-auto lg:right-6 lg:bottom-[6.5rem] lg:top-auto lg:w-[420px] lg:h-[600px] lg:max-h-[calc(100vh-9rem)] lg:rounded-2xl
          ${aberto ? "cfab-panel-open pointer-events-auto" : "pointer-events-none"}`}
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
