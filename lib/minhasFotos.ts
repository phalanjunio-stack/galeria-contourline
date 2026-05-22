/**
 * lib/minhasFotos — fonte única de "minhas fotos".
 *
 * Estratégia:
 *   1. Drive (_mf_{email}.json) é a fonte de verdade.
 *   2. localStorage (mf_user_v4_${email}) é cache de leitura com TTL curto.
 *   3. Todas as escritas (admin indexação, "São minhas", cadastrar-rosto) emitem
 *      `minhas-fotos-atualizada` no window → todos os consumidores re-buscam.
 *
 * Migração: caches antigos (minhas_fotos_v1, mf_v2_*) são removidos
 * automaticamente na primeira leitura desta versão.
 */

export const FACE_DESC_KEY    = "face_descriptor_v1";
const CACHE_KEY_PREFIX        = "mf_user_v4_";
const CACHE_TTL_HIT_MS        = 2 * 60 * 1000;   // 2 min quando achou
const CACHE_TTL_MISS_MS       = 30 * 1000;       // 30s quando não achou
const EVENTO_ATUALIZADO       = "minhas-fotos-atualizada";

let migracaoFeita = false;
function migrarCachesAntigos() {
  if (migracaoFeita || typeof localStorage === "undefined") return;
  migracaoFeita = true;
  try {
    localStorage.removeItem("minhas_fotos_v1");
    const remover: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("mf_v2_") || k?.startsWith("mf_user_v3_")) remover.push(k);
    }
    remover.forEach(k => localStorage.removeItem(k));
  } catch { /* ignora */ }
}

export interface MinhasFotosEvento {
  eventoId:   string;
  eventoNome: string;
  fotos:      string[];
}

export interface FotoMatch {
  id:        string;
  distancia: number;
}

export interface MinhasFotosData {
  matches:   FotoMatch[];
  porEvento: MinhasFotosEvento[];
}

interface CacheEntry extends MinhasFotosData {
  ts:    number;
  vazio: boolean;
}

function cacheKey(email: string) {
  return `${CACHE_KEY_PREFIX}${email.toLowerCase()}`;
}

/* ── Leitura do cache (síncrono, pra render imediato) ──────── */
export function lerCacheMinhasFotos(email: string): MinhasFotosData | null {
  migrarCachesAntigos();
  if (!email) return null;
  try {
    const raw = localStorage.getItem(cacheKey(email));
    if (!raw) return null;
    const c: CacheEntry = JSON.parse(raw);
    const ttl = c.vazio ? CACHE_TTL_MISS_MS : CACHE_TTL_HIT_MS;
    if (Date.now() - c.ts > ttl) return null;
    return { matches: c.matches, porEvento: c.porEvento };
  } catch { return null; }
}

function gravarCache(email: string, data: MinhasFotosData) {
  if (!email) return;
  try {
    const entry: CacheEntry = {
      matches:   data.matches,
      porEvento: data.porEvento,
      ts:        Date.now(),
      vazio:     data.matches.length === 0,
    };
    localStorage.setItem(cacheKey(email), JSON.stringify(entry));
  } catch { /* ignora */ }
}

/* ── Busca no Drive + cache (assíncrono, fonte de verdade) ── */
export async function fetchMinhasFotos(email: string): Promise<MinhasFotosData | null> {
  migrarCachesAntigos();
  if (!email) return null;
  try {
    const res = await fetch(`/api/meu/fotos?email=${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return lerCacheMinhasFotos(email);
    const data = await res.json();
    if (!data?.eventos?.length) {
      // Drive vazio — grava miss e retorna
      gravarCache(email, { matches: [], porEvento: [] });
      return { matches: [], porEvento: [] };
    }
    const todasFotos: string[] = [];
    const porEvento: MinhasFotosEvento[] = [];
    for (const ev of data.eventos) {
      for (const id of ev.fotoIds) if (!todasFotos.includes(id)) todasFotos.push(id);
      porEvento.push({ eventoId: ev.eventoId, eventoNome: ev.eventoNome, fotos: ev.fotoIds });
    }
    const result: MinhasFotosData = {
      matches:   todasFotos.map(id => ({ id, distancia: 0.3 })),
      porEvento,
    };
    gravarCache(email, result);
    return result;
  } catch {
    return lerCacheMinhasFotos(email);
  }
}

/**
 * Grava dados em cache local — usado quando NÃO veio do Drive (busca local
 * via descriptor, "São minhas" pendente de sincronização etc.).
 * Não vai pro Drive (admin é quem escreve oficialmente).
 */
export function salvarCacheMinhasFotos(email: string, data: MinhasFotosData) {
  gravarCache(email, data);
  notificarAtualizacao();
}

/**
 * Limpa o cache local de um usuário (ou todos) e notifica.
 */
export function invalidarMinhasFotos(email?: string) {
  try {
    if (email) {
      localStorage.removeItem(cacheKey(email));
    } else {
      const remover: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(CACHE_KEY_PREFIX)) remover.push(k);
      }
      remover.forEach(k => localStorage.removeItem(k));
    }
  } catch { /* ignora */ }
  notificarAtualizacao();
}

/** Dispara evento global pra todos os consumidores re-buscarem. */
export function notificarAtualizacao() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_ATUALIZADO));
}

/** Inscrição num listener de atualização. Retorna função de unsubscribe. */
export function ouvirAtualizacoes(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener(EVENTO_ATUALIZADO, h);
  // Compat com evento antigo de "São minhas"
  window.addEventListener("minhas-fotos-confirmadas", h);
  return () => {
    window.removeEventListener(EVENTO_ATUALIZADO, h);
    window.removeEventListener("minhas-fotos-confirmadas", h);
  };
}

/* ── Descriptor (suporta múltiplas selfies) ────────────────── */

const FACE_DESCS_KEY = "face_descriptors_v1";   // array de descritores (NOVO)

/**
 * Lê o descriptor principal (compat: primeira selfie do array, ou legado single).
 */
export function lerDescriptor(): Float32Array | null {
  const todos = lerDescriptors();
  return todos.length > 0 ? todos[0] : null;
}

/**
 * Lê TODOS os descriptors do usuário (múltiplas selfies).
 * Prioridade: novo array → legado single.
 */
export function lerDescriptors(): Float32Array[] {
  try {
    // Tenta o novo formato primeiro
    const rawArr = sessionStorage.getItem("faceDescriptors") ?? localStorage.getItem(FACE_DESCS_KEY);
    if (rawArr) {
      const arr = JSON.parse(rawArr) as number[][];
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map(d => new Float32Array(d));
      }
    }
    // Fallback: legado single
    const rawSingle = sessionStorage.getItem("faceDescriptor") ?? localStorage.getItem(FACE_DESC_KEY);
    if (rawSingle) {
      return [new Float32Array(JSON.parse(rawSingle))];
    }
  } catch { /* ignora */ }
  return [];
}

/** Salva 1 descriptor (modo single — compat). */
export function salvarDescriptor(arr: number[], email?: string) {
  salvarDescriptors([arr], email);
}

/** Salva múltiplos descriptors (array de selfies). */
export function salvarDescriptors(arrs: number[][], email?: string) {
  if (arrs.length === 0) return;
  const json = JSON.stringify(arrs);
  try { sessionStorage.setItem("faceDescriptors", json); } catch {}
  try { localStorage.setItem(FACE_DESCS_KEY, json);      } catch {}
  // Mantém o legado pro caso de algum lugar antigo ainda ler
  try { sessionStorage.setItem("faceDescriptor",  JSON.stringify(arrs[0])); } catch {}
  try { localStorage.setItem(FACE_DESC_KEY,       JSON.stringify(arrs[0])); } catch {}
  invalidarMinhasFotos(email);
}

/** Adiciona um descritor à lista existente (sem invalidar matches já achados). */
export function adicionarDescriptor(arr: number[]) {
  try {
    const atuais = lerDescriptors().map(f => Array.from(f));
    const novos: number[][] = [...atuais, arr];
    const json = JSON.stringify(novos);
    sessionStorage.setItem("faceDescriptors", json);
    localStorage.setItem(FACE_DESCS_KEY,      json);
  } catch {}
}

/**
 * Calcula MENOR distância entre o rosto da foto e CADA descritor do usuário.
 * Quanto mais selfies o user tiver, mais chances de bater.
 */
export function menorDistancia(perfilDescriptors: Float32Array[], rostoDescriptor: number[]): number {
  if (perfilDescriptors.length === 0) return Infinity;
  let melhor = Infinity;
  for (const d of perfilDescriptors) {
    let soma = 0;
    for (let i = 0; i < d.length; i++) {
      const diff = d[i] - rostoDescriptor[i];
      soma += diff * diff;
    }
    const dist = Math.sqrt(soma);
    if (dist < melhor) melhor = dist;
  }
  return melhor;
}

/* ── Compat: re-exporta nomes antigos pra evitar quebra durante migração ── */
/** @deprecated use fetchMinhasFotos ou lerCacheMinhasFotos */
export function lerMinhasFotos(): (MinhasFotosData & { ts: number }) | null {
  migrarCachesAntigos();
  return null; // cache antigo já não existe
}
/** @deprecated use salvarCacheMinhasFotos(email, data) */
export function salvarMinhasFotos(_data: MinhasFotosData) {
  // No-op: o novo fluxo precisa do email. Mantido só pra não quebrar imports
  // até todos os consumidores migrarem.
}
/** @deprecated use invalidarMinhasFotos(email) */
export function invalidarCacheResultados(email?: string) {
  invalidarMinhasFotos(email);
}
