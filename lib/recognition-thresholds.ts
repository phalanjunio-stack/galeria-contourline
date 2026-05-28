export interface RecognitionThresholds {
  admin: number;
  usuario: number;
  resultado: number;
}

export type RecognitionThresholdKey = keyof RecognitionThresholds;

// Calibrados em produção:
//   admin    = 0.48 — admin confirma manualmente, pode ser estrito
//   usuario  = 0.55 — busca automatica no evento, +permissivo (mais matches)
//   resultado= 0.60 — busca direta por rosto, ainda mais permissivo
export const DEFAULT_RECOGNITION_THRESHOLDS: RecognitionThresholds = {
  admin: 0.48,
  usuario: 0.55,
  resultado: 0.60,
};

export const RECOGNITION_THRESHOLDS_KEY = "config_thresholds";

function sanitizeThreshold(value: unknown, fallback: number) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) return fallback;
  return Math.min(0.8, Math.max(0.3, threshold));
}

export function normalizeRecognitionThresholds(value: unknown): RecognitionThresholds {
  const raw = value && typeof value === "object"
    ? value as Partial<Record<RecognitionThresholdKey, unknown>>
    : {};

  return {
    admin: sanitizeThreshold(raw.admin, DEFAULT_RECOGNITION_THRESHOLDS.admin),
    usuario: sanitizeThreshold(raw.usuario, DEFAULT_RECOGNITION_THRESHOLDS.usuario),
    resultado: sanitizeThreshold(raw.resultado, DEFAULT_RECOGNITION_THRESHOLDS.resultado),
  };
}

export function lerRecognitionThresholdsLocal(): RecognitionThresholds {
  if (typeof localStorage === "undefined") return DEFAULT_RECOGNITION_THRESHOLDS;

  try {
    const raw = localStorage.getItem(RECOGNITION_THRESHOLDS_KEY);
    return raw ? normalizeRecognitionThresholds(JSON.parse(raw)) : DEFAULT_RECOGNITION_THRESHOLDS;
  } catch {
    return DEFAULT_RECOGNITION_THRESHOLDS;
  }
}

export function lerRecognitionThresholdLocal(key: RecognitionThresholdKey) {
  return lerRecognitionThresholdsLocal()[key];
}

export function salvarRecognitionThresholdsLocal(thresholds: RecognitionThresholds) {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      RECOGNITION_THRESHOLDS_KEY,
      JSON.stringify(normalizeRecognitionThresholds(thresholds))
    );
  } catch {
    // Local storage is only a browser preference; ignore quota/privacy failures.
  }
}
