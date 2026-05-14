import { enviarEmail, emailEncontrado } from "./email";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export function gerarToken(email: string, eventoSlug: string): string {
  const payload = JSON.stringify({ e: email, s: eventoSlug, t: Math.floor(Date.now() / 1000) });
  return Buffer.from(payload).toString("base64url");
}

export function decodificarToken(token: string): { email: string; eventoSlug: string; ts: number } | null {
  try {
    const obj = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    return { email: obj.e, eventoSlug: obj.s, ts: obj.t };
  } catch { return null; }
}

export function gerarLink(email: string, eventoSlug: string): string {
  return `${BASE_URL}/fotos?t=${gerarToken(email, eventoSlug)}`;
}

export interface NotifPayload {
  email:      string;
  nomeEvento: string;
  eventoSlug: string;
  thumbUrl?:  string;
  notifSite:  boolean;
  notifEmail?: boolean;   // default false — habilitar depois quando email tiver SMTP
}

export interface ResultadoNotif {
  canal:  "email" | "site";
  ok:     boolean;
  status?: number;
  erro?:   string;
}

export async function notificarUsuario(p: NotifPayload): Promise<ResultadoNotif[]> {
  const link = gerarLink(p.email, p.eventoSlug);
  const resultados: ResultadoNotif[] = [];

  // ── EMAIL ── (desabilitado por padrão — só envia se notifEmail=true)
  if (p.notifEmail) {
    try {
      const html = emailEncontrado(p.nomeEvento, link, p.thumbUrl);
      const ok   = await enviarEmail(
        p.email,
        `📸 Acho que é você nas fotos de ${p.nomeEvento}!`,
        html,
      );
      resultados.push({ canal: "email", ok, erro: ok ? undefined : "enviarEmail retornou false (cheque EMAIL_USER/EMAIL_PASS)" });
    } catch (e) {
      console.error("[Notif] Email falhou:", e);
      resultados.push({ canal: "email", ok: false, erro: String(e) });
    }
  }

  // ── SININHO NO SITE ─────────────────────────────────────────
  if (p.notifSite) {
    try {
      const res = await fetch(`${BASE_URL}/api/notificacoes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:    p.email,
          tipo:     "fotos_encontradas",
          titulo:   `📸 Acho que é você em ${p.nomeEvento}! 🤔`,
          mensagem: `Encontramos suas fotos. Clique para ver.`,
          link,
          thumb:    p.thumbUrl,
        }),
      });
      if (!res.ok) {
        const erro = await res.text().catch(() => "");
        console.error(`[Notif] Sininho falhou (HTTP ${res.status}):`, erro);
        resultados.push({ canal: "site", ok: false, status: res.status, erro });
      } else {
        resultados.push({ canal: "site", ok: true });
      }
    } catch (e) {
      console.error("[Notif] Sininho — erro de rede:", e);
      resultados.push({ canal: "site", ok: false, erro: String(e) });
    }
  }

  return resultados;
}
