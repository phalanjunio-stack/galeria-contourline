/**
 * Sons procedurais via Web Audio API — Galeria Contourline
 *
 * Kinds:
 *   open    — sweep ascendente (abrir painel/lightbox)
 *   close   — sweep descendente (fechar)
 *   whoosh  — navegação rápida (prev/next no lightbox)
 *   snap    — clique satisfatório curto (favoritar, selecionar)
 *   ding    — sino suave (match encontrado, sucesso)
 *   tap     — toque leve (download, ação secundária)
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
export type SoundKind  = SwooshKind | "whoosh" | "snap" | "ding" | "tap";

export function playSwoosh(kind: SwooshKind) {
  playSound(kind);
}

export function playSound(kind: SoundKind) {
  if (!soundsEnabled()) return;
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;

  switch (kind) {
    // ── open: sweep ascendente ──────────────────────────────────────────────
    case "open": {
      const duration = 0.28;
      const noise = ac.createBufferSource();
      noise.buffer = makeNoiseBuffer(ac, duration * 1000);
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(4200, now + duration);
      const noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(filter).connect(noiseGain).connect(ac.destination);
      noise.start(now); noise.stop(now + duration + 0.02);

      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + duration);
      const oscGain = ac.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(oscGain).connect(ac.destination);
      osc.start(now); osc.stop(now + duration + 0.02);
      break;
    }

    // ── close: sweep descendente ────────────────────────────────────────────
    case "close": {
      const duration = 0.28;
      const noise = ac.createBufferSource();
      noise.buffer = makeNoiseBuffer(ac, duration * 1000);
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(4200, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + duration);
      const noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(filter).connect(noiseGain).connect(ac.destination);
      noise.start(now); noise.stop(now + duration + 0.02);

      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + duration);
      const oscGain = ac.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(oscGain).connect(ac.destination);
      osc.start(now); osc.stop(now + duration + 0.02);
      break;
    }

    // ── whoosh: rafada rápida lateral (navegação lightbox) ──────────────────
    case "whoosh": {
      const duration = 0.18;
      const noise = ac.createBufferSource();
      noise.buffer = makeNoiseBuffer(ac, duration * 1000);
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(800, now);
      hp.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.6);
      hp.frequency.exponentialRampToValueAtTime(500, now + duration);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(hp).connect(g).connect(ac.destination);
      noise.start(now); noise.stop(now + duration + 0.02);
      break;
    }

    // ── snap: clique curto satisfatório (favoritar, selecionar) ────────────
    case "snap": {
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(g).connect(ac.destination);
      osc.start(now); osc.stop(now + 0.1);

      // Clique de impacto pequeno
      const noise = ac.createBufferSource();
      noise.buffer = makeNoiseBuffer(ac, 40);
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2000;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.15, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      noise.connect(lp).connect(ng).connect(ac.destination);
      noise.start(now); noise.stop(now + 0.05);
      break;
    }

    // ── ding: sino suave (match encontrado, sucesso) ────────────────────────
    case "ding": {
      // Harmônicos tipo sino: fundamental + 2.76x + 5.4x
      const freqs = [880, 2428, 4752];
      const amps  = [0.18, 0.08, 0.04];
      const decays = [0.6, 0.4, 0.25];
      freqs.forEach((f, i) => {
        const osc = ac.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ac.createGain();
        g.gain.setValueAtTime(amps[i], now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
        osc.connect(g).connect(ac.destination);
        osc.start(now); osc.stop(now + decays[i] + 0.05);
      });
      // Ataque suave de impacto
      const noise = ac.createBufferSource();
      noise.buffer = makeNoiseBuffer(ac, 30);
      const lp = ac.createBiquadFilter();
      lp.type = "bandpass";
      lp.frequency.value = 3000;
      lp.Q.value = 2;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.05, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      noise.connect(lp).connect(ng).connect(ac.destination);
      noise.start(now); noise.stop(now + 0.04);
      break;
    }

    // ── tap: toque leve neutro (download, ação secundária) ──────────────────
    case "tap": {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(g).connect(ac.destination);
      osc.start(now); osc.stop(now + 0.09);
      break;
    }
  }
}

/** Liga/desliga sons globalmente (persiste em localStorage). */
export function setSoundsEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch {}
}

export function isSoundsEnabled(): boolean {
  return soundsEnabled();
}
