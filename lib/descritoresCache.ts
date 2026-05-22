/**
 * Cache local dos índices de descritores faciais.
 *
 * `/api/descritores?eventoId=X` retorna ~1-2MB por evento. Sem cache, todo
 * acesso a /resultado, /eventos, /favoritos etc. baixa tudo de novo.
 * Com cache (30min TTL), a 2ª visita usa o que tá no localStorage.
 */

export interface FotoDescritores {
  fotoId: string;
  rostos: { descriptor: number[] }[];
}

export interface DescritoresResposta {
  indexado: boolean;
  dados:    FotoDescritores[];
}

const TTL_MS     = 30 * 60 * 1000;   // 30 min
const KEY_PREFIX = "desc_cache_v1_";

interface CacheEntry extends DescritoresResposta {
  cachedAt: number;
}

function chave(eventoId: string) {
  return `${KEY_PREFIX}${eventoId}`;
}

/**
 * Busca descritores do evento — cache local 30min, fallback /api.
 * Retorna null em caso de erro de rede.
 */
export async function fetchDescritores(eventoId: string): Promise<DescritoresResposta | null> {
  // 1. Cache local
  try {
    const raw = localStorage.getItem(chave(eventoId));
    if (raw) {
      const c: CacheEntry = JSON.parse(raw);
      if (Date.now() - c.cachedAt < TTL_MS) {
        return { indexado: c.indexado, dados: c.dados };
      }
    }
  } catch { /* ignora */ }

  // 2. API
  try {
    const r = await fetch(`/api/descritores?eventoId=${eventoId}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const data: DescritoresResposta = await r.json();

    // Só cacheia se for indexado e tiver dados — sem encher localStorage com "vazio"
    if (data?.indexado && Array.isArray(data.dados) && data.dados.length > 0) {
      const entry: CacheEntry = { ...data, cachedAt: Date.now() };
      try {
        localStorage.setItem(chave(eventoId), JSON.stringify(entry));
      } catch {
        // Quota cheio — remove os mais antigos e tenta de novo
        despejarMaisAntigos();
        try { localStorage.setItem(chave(eventoId), JSON.stringify(entry)); } catch { /* desiste */ }
      }
    }

    return data;
  } catch { return null; }
}

/**
 * Limpa cache de descritores — chamado quando admin reindexa um evento.
 * Sem eventoId, limpa todos.
 */
export function invalidarDescritoresCache(eventoId?: string) {
  try {
    if (eventoId) {
      localStorage.removeItem(chave(eventoId));
      return;
    }
    const remover: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) remover.push(k);
    }
    remover.forEach(k => localStorage.removeItem(k));
  } catch { /* ignora */ }
}

/** Remove metade dos caches mais antigos (LRU) — chamado quando quota cheia. */
function despejarMaisAntigos() {
  const entries: { key: string; cachedAt: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(KEY_PREFIX)) continue;
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? "{}");
        entries.push({ key: k, cachedAt: v.cachedAt ?? 0 });
      } catch { entries.push({ key: k, cachedAt: 0 }); }
    }
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    const remover = Math.max(1, Math.ceil(entries.length / 2));
    entries.slice(0, remover).forEach(e => localStorage.removeItem(e.key));
  } catch { /* ignora */ }
}
