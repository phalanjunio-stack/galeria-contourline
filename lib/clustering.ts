/**
 * Face clustering — agrupa rostos parecidos detectados no mesmo evento.
 *
 * Algoritmo: single-pass agglomerative.
 * - Cada rosto é comparado com os centroides dos clusters existentes
 * - Se distância < threshold, junta ao cluster mais próximo e atualiza centroide
 * - Caso contrário, cria cluster novo
 *
 * Resultado: lista de "pessoas únicas" do evento. Match do usuário é então feito
 * contra essa lista pequena (ex: 50 pessoas) em vez de TODOS os rostos detectados
 * (ex: 1500 detections) — escala muito melhor.
 */

export interface FaceDetection {
  fotoId:     string;
  descriptor: number[];   // 128-D do face-api
}

export interface ClusterPessoa {
  clusterId:       string;
  descritor_medio: number[];   // centroide do cluster (média dos descritores)
  fotos:           string[];   // IDs de fotos onde essa pessoa aparece (únicos)
  rostosDetectados: number;    // quantos rostos foram agrupados aqui (qualidade da cluster)
}

function euclideanDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * Agrupa rostos por similaridade.
 *
 * @param deteccoes lista plana de rostos detectados (foto + descriptor)
 * @param threshold distância máxima pra considerar mesma pessoa (0.45-0.55)
 * @returns lista de clusters
 */
export function clusterizar(
  deteccoes: FaceDetection[],
  threshold = 0.50
): ClusterPessoa[] {
  const clusters: ClusterPessoa[] = [];

  for (const det of deteccoes) {
    if (!Array.isArray(det.descriptor) || det.descriptor.length !== 128) continue;

    // Acha cluster mais próximo
    let melhorCluster: ClusterPessoa | null = null;
    let melhorDist    = Infinity;
    for (const c of clusters) {
      const d = euclideanDistance(det.descriptor, c.descritor_medio);
      if (d < melhorDist) {
        melhorDist    = d;
        melhorCluster = c;
      }
    }

    if (melhorCluster && melhorDist < threshold) {
      // Junta ao cluster existente — atualiza centroide (média móvel)
      const n = melhorCluster.rostosDetectados;
      for (let i = 0; i < 128; i++) {
        melhorCluster.descritor_medio[i] =
          (melhorCluster.descritor_medio[i] * n + det.descriptor[i]) / (n + 1);
      }
      melhorCluster.rostosDetectados = n + 1;
      if (!melhorCluster.fotos.includes(det.fotoId)) {
        melhorCluster.fotos.push(det.fotoId);
      }
    } else {
      // Novo cluster
      clusters.push({
        clusterId:        cryptoRandomId(),
        descritor_medio:  [...det.descriptor],
        fotos:            [det.fotoId],
        rostosDetectados: 1,
      });
    }
  }

  return clusters;
}

/**
 * Acha cluster com menor distância ao descriptor (1 ou mais selfies do usuário).
 * Retorna { cluster, dist } ou null se nenhum estiver suficientemente perto.
 */
export function acharClusterParaUsuario(
  clusters: ClusterPessoa[],
  descritoresUser: number[][],
  threshold = 0.65
): { cluster: ClusterPessoa; dist: number } | null {
  let melhor: { cluster: ClusterPessoa; dist: number } | null = null;
  for (const c of clusters) {
    // Compara com TODAS as selfies do usuário, pega a menor distância
    for (const desc of descritoresUser) {
      const d = euclideanDistance(c.descritor_medio, desc);
      if (d < threshold && (!melhor || d < melhor.dist)) {
        melhor = { cluster: c, dist: d };
      }
    }
  }
  return melhor;
}

/** Acha TODOS os clusters dentro do threshold (caso pessoa esteja "split" em 2 clusters). */
export function acharClustersDoUsuario(
  clusters: ClusterPessoa[],
  descritoresUser: number[][],
  threshold = 0.65
): ClusterPessoa[] {
  const achados: ClusterPessoa[] = [];
  for (const c of clusters) {
    for (const desc of descritoresUser) {
      const d = euclideanDistance(c.descritor_medio, desc);
      if (d < threshold) {
        achados.push(c);
        break; // já adicionou esse cluster, não precisa comparar outras selfies
      }
    }
  }
  return achados;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
