import { Pool } from "pg";
import type { ClusterPessoa } from "@/lib/clustering";

const VECTOR_SIZE = 128;

type DbClusterRow = {
  evento_id: string;
  cluster_key: string;
  embedding: string | number[];
  foto_ids: string[];
  rostos_detectados: number;
  distance?: number | string;
};

export interface ClusterMatchDb {
  eventoId: string;
  cluster: ClusterPessoa;
  dist: number;
}

const globalForFaceIndex = globalThis as typeof globalThis & {
  faceIndexPool?: Pool;
};

export function faceIndexDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!globalForFaceIndex.faceIndexPool) {
    globalForFaceIndex.faceIndexPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return globalForFaceIndex.faceIndexPool;
}

function toVector(value: number[]) {
  if (!Array.isArray(value) || value.length !== VECTOR_SIZE) {
    throw new Error(`Descriptor facial precisa ter ${VECTOR_SIZE} valores`);
  }
  return `[${value.map((n) => Number(n).toString()).join(",")}]`;
}

function parseVector(value: string | number[]) {
  if (Array.isArray(value)) return value.map(Number);
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .filter(Boolean)
    .map(Number);
}

function toCluster(row: DbClusterRow): ClusterPessoa {
  return {
    clusterId: row.cluster_key,
    descritor_medio: parseVector(row.embedding),
    fotos: row.foto_ids ?? [],
    rostosDetectados: Number(row.rostos_detectados) || 0,
  };
}

export async function lerClustersDoEventoDb(eventoId: string) {
  const pool = getPool();
  if (!pool) return null;

  const result = await pool.query<DbClusterRow>(
    `SELECT evento_id, cluster_key, embedding::text AS embedding, foto_ids, rostos_detectados
       FROM face_index_clusters
      WHERE evento_id = $1
      ORDER BY rostos_detectados DESC, id ASC`,
    [eventoId]
  );
  return result.rows.map(toCluster);
}

export async function buscarClustersDb({
  eventoIds,
  descriptors,
  limit = 8,
  threshold = 0.65,
}: {
  eventoIds: string[];
  descriptors: number[][];
  limit?: number;
  threshold?: number;
}) {
  const pool = getPool();
  if (!pool) return null;

  const validDescriptors = descriptors.filter((d) => d.length === VECTOR_SIZE);
  if (validDescriptors.length === 0 || eventoIds.length === 0) return [];

  const melhores = new Map<string, ClusterMatchDb>();
  for (const descriptor of validDescriptors) {
    const result = await pool.query<DbClusterRow>(
      `SELECT evento_id,
              cluster_key,
              embedding::text AS embedding,
              foto_ids,
              rostos_detectados,
              embedding <-> $1::vector AS distance
         FROM face_index_clusters
        WHERE evento_id = ANY($2::text[])
          AND embedding <-> $1::vector < $3
        ORDER BY embedding <-> $1::vector
        LIMIT $4`,
      [toVector(descriptor), eventoIds, threshold, limit]
    );

    for (const row of result.rows) {
      const dist = Number(row.distance);
      const key = `${row.evento_id}:${row.cluster_key}`;
      const anterior = melhores.get(key);
      if (!anterior || dist < anterior.dist) {
        melhores.set(key, {
          eventoId: row.evento_id,
          cluster: toCluster(row),
          dist,
        });
      }
    }
  }

  return [...melhores.values()].sort((a, b) => a.dist - b.dist);
}
