/**
 * Compartilhamento nativo via Web Share API (mobile).
 * Em desktop ou browser sem suporte, faz fallback: copia link e abre WhatsApp Web/Instagram.
 */

export interface CompartilharFotoOpts {
  fotoId:      string;
  nomeEvento?: string;
  origem?:     string;   // base URL (default = window.location.origin)
}

export type CompartilharResultado =
  | { canal: "nativo";      ok: true }
  | { canal: "clipboard";   ok: true }
  | { canal: "whatsapp";    ok: true }
  | { canal: "erro";        ok: false; motivo: string };

/** URL pública da foto via thumb de alta resolução. */
export function urlFoto(fotoId: string, origem?: string) {
  const base = origem ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/api/thumb?id=${fotoId}&sz=1200`;
}

export async function compartilharFoto(opts: CompartilharFotoOpts): Promise<CompartilharResultado> {
  const { fotoId, nomeEvento, origem } = opts;
  const url   = urlFoto(fotoId, origem);
  const texto = nomeEvento ? `Olha essa foto do ${nomeEvento}!` : "Olha essa foto!";

  // 1. Web Share API nativo (mobile principalmente)
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: "Contourline", text: texto, url });
      return { canal: "nativo", ok: true };
    } catch (e) {
      // Usuário cancelou o diálogo nativo — não é erro real
      const err = e as { name?: string };
      if (err?.name === "AbortError") return { canal: "erro", ok: false, motivo: "cancelado" };
      // Cai pro fallback abaixo
    }
  }

  // 2. Fallback: copia link no clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return { canal: "clipboard", ok: true };
    } catch { /* segue pro próximo */ }
  }

  // 3. Último fallback: WhatsApp Web direto
  try {
    const msg = encodeURIComponent(`${texto} ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener");
    return { canal: "whatsapp", ok: true };
  } catch (e) {
    return { canal: "erro", ok: false, motivo: String(e) };
  }
}
