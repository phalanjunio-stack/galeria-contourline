/**
 * Sons swoosh procedurais via Web Audio API.
 * Open  = sweep ascendente curto (sub→agudo) com ruído filtrado
 * Close = sweep descendente curto (agudo→sub) com ruído filtrado
 *
 * Uso: import { playSwoosh } from "@/lib/sounds";
 *      playSwoosh("open"); playSwoosh("close");
 *
 * Respeita prefers-reduced-motion e localStorage "galeria-sounds" (default: on).
 */

const STORAGE_KEY = "galeria-sounds";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext || W.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "off") return false;
  } catch {}
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {}
  return true;
}

function makeNoiseBuffer(ac: AudioContext, durationMs: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ac.sampleRate * (durationMs / 1000)));
  const buf = ac.createBuffer(1, length, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export type SwooshKind = "open" | "close";

export function playSwoosh(kind: SwooshKind) {
  if (!soundsEnabled()) return;
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;
  const duration = 0.28; // ~280ms

  // ── Camada 1: ruído branco passado por filtro lowpass com sweep ──
  const noise = ac.createBufferSource();
  noise.buffer = makeNoiseBuffer(ac, duration * 1000);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 1.2;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  if (kind === "open") {
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + duration);
  } else {
    filter.frequency.setValueAtTime(4200, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + duration);
  }

  noise.connect(filter).connect(noiseGain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + duration + 0.02);

  // ── Camada 2: tom senoidal sutil que sobe/desce ──
  const osc = ac.createOscillator();
  osc.type = "sine";
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  if (kind === "open") {
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + duration);
  } else {
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + duration);
  }
  osc.connect(oscGain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Liga/desliga sons globalmente (persiste em localStorage). */
export function setSoundsEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch {}
}

export function isSoundsEnabled(): boolean {
  return soundsEnabled();
}
