// Inicializacao face-api em Node + funcao de detectar rostos numa foto
// face-api node-wasm + canvas v3 (binarios pre-compilados)
import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import faceapiPkg from "@vladmandic/face-api/dist/face-api.node-wasm.js";
const faceapi = faceapiPkg.default || faceapiPkg;
import canvas from "canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Canvas, Image, ImageData, loadImage, createCanvas } = canvas;

// Aponta para arquivos .wasm dentro de node_modules
const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
const wasmDir = path.resolve(__dirname2, "..", "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist");
setWasmPaths(wasmDir + "/");

// Patch para face-api usar canvas do Node
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, "..", "models");

let initialized = false;

export async function initFaceApi() {
  if (initialized) return;
  // Backend WASM (acelera tfjs sem precisar tfjs-node nativo)
  await tf.setBackend("wasm");
  await tf.ready();
  console.log("[face] Backend TF:", tf.getBackend());

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
  initialized = true;
  console.log("[face] Modelos carregados (SsdMobilenetv1)");
}

// Detecta rostos numa imagem (Buffer de PNG/JPEG) e retorna descriptor + area do rosto.
export async function detectarRostos(buffer) {
  await initFaceApi();
  const img = await loadImage(buffer);
  const cnv = createCanvas(img.width, img.height);
  const ctx = cnv.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const options = new faceapi.SsdMobilenetv1Options({
    minConfidence: 0.5,
    maxResults: 50,
  });

  const detections = await faceapi
    .detectAllFaces(cnv, options)
    .withFaceLandmarks(false) // full landmarks (não tiny)
    .withFaceDescriptors();

  // Filtra rostos muito pequenos (< 40px) — descritor seria ruim
  return detections
    .filter((d) => Math.min(d.detection.box.width, d.detection.box.height) >= 40)
    .map((d) => ({
      descriptor: Array.from(d.descriptor),
      box: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      score: d.detection.score,
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
