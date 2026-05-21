/**
 * Carregador centralizado dos modelos face-api.js (client-side).
 *
 * USA: SsdMobilenetv1 (detector pesado, MUITO mais preciso que TinyFaceDetector)
 *      + face_landmark_68 (full, não tiny) + face_recognition_model (128-d)
 *
 * Por que SsdMobilenetv1?
 * - Tiny detecta ~70% dos rostos, com muitos falsos positivos em rostos pequenos/laterais.
 * - SSD detecta ~95% dos rostos com confiança real → descritores muito mais consistentes
 *   → menos falso negativo quando você procura com selfie de outro local.
 * - Custo: ~5.6 MB de modelo (vs 190 KB) e ~3x mais lento. Vale a pena.
 */

const MODELS_URL = "/models";

export async function loadFaceModels() {
  const faceapi = await import("face-api.js");
  if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
  }
  return faceapi;
}

/**
 * Opções de detecção. minConfidence=0.5 é o sweet spot:
 * baixo o suficiente pra pegar rostos laterais/parciais, alto o suficiente
 * pra descartar artefatos (logos, padrões na parede que parecem rosto).
 */
export function detectorOptions(faceapi: typeof import("face-api.js"), minConfidence = 0.5) {
  return new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 50 });
}
