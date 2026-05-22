// Armazena IDs de fotos que o usuário marcou como "Não sou eu"
// para parar de mostrar no banner e nas sugestões da IA.

const KEY = "fotos_rejeitadas_v1";

export function lerRejeitadas(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function salvarRejeitadas(rejeitadas: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(rejeitadas)));
  } catch { /**/ }
}

export function rejeitarFoto(id: string) {
  const atual = lerRejeitadas();
  atual.add(id);
  salvarRejeitadas(atual);
  // Avisa outros componentes
  try { window.dispatchEvent(new CustomEvent("fotos-rejeitadas-mudou", { detail: { id } })); } catch {}
}

export function desfazerRejeicao(id: string) {
  const atual = lerRejeitadas();
  atual.delete(id);
  salvarRejeitadas(atual);
  try { window.dispatchEvent(new CustomEvent("fotos-rejeitadas-mudou", { detail: { id } })); } catch {}
}

export function filtrarRejeitadas<T extends string | { id: string }>(items: T[]): T[] {
  const r = lerRejeitadas();
  if (r.size === 0) return items;
  return items.filter(i => !r.has(typeof i === "string" ? i : i.id));
}
