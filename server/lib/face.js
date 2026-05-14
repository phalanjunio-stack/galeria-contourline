// Inicializacao face-api em Node + funcao de detectar rostos numa foto
import * as faceapi from "@vladmandic/face-api";
import * as tf from "@tensorflow/tfjs-node";
import canvas from "canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Canvas, Image, ImageData, loadImage } = canvas;
// Patch para face-api usar canvas do Node
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, "..", "models");

let initialized = false;

export async function initFaceApi() {
  if (initialized) return;
  // tfjs-node ja carrega backend nativo
  await tf.ready();
  console.log("[face] Backend TF:", tf.getBackend());

  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
  initialized = true;
  console.log("[face] Modelos carregados");
}

// Detecta rostos numa imagem (Buffer de PNG/JPEG) e retorna lista de descritores
// Cada descritor: Array<128 numeros>
export async function detectarRostos(buffer) {
  await initFaceApi();
  const img = await loadImage(buffer);
  const cnv = canvas.createCanvas(img.width, img.height);
  const ctx = cnv.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 608,
    scoreThreshold: 0.15,
  });

  const detections = await faceapi
    .detectAllFaces(cnv, options)
    .withFaceLandmarks(true) // tiny landmarks
    .withFaceDescriptors();

  return detections.map((d) => ({
    descriptor: Array.from(d.descriptor),
  }));
}

// Distancia euclidiana entre dois descritores (128 dimensoes)
export function distanceEuclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
