import { Pool } from "pg";
import type { ClusterPessoa } from "@/lib/clustering";

const VECTOR_SIZE = 128;
let schemaReady: Promise<void> | null = null;

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

async function ensureSchema() {
  const pool = getPool();
  if (!pool) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS face_index_events (
          evento_id text PRIMARY KEY,
          evento_nome text NOT NULL,
          drive_folder_id text NOT NULL,
          total_fotos integer NOT NULL DEFAULT 0,
          fotos_com_rosto integer NOT NULL DEFAULT 0,
          rostos_detectados integer NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'ready',
          indexed_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS face_index_faces (
          id bigserial PRIMARY KEY,
          evento_id text NOT NULL REFERENCES face_index_events(evento_id) ON DELETE CASCADE,
          foto_id text NOT NULL,
          face_ordem integer NOT NULL,
          embedding vector(128) NOT NULL,
          box_x real,
          box_y real,
          box_width real,
          box_height real,
          detection_score real,
          crop_url text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (evento_id, foto_id, face_ordem)
        )`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS face_index_clusters (
          id bigserial PRIMARY KEY,
          evento_id text NOT NULL REFERENCES face_index_events(evento_id) ON DELETE CASCADE,
          cluster_key text NOT NULL,
          embedding vector(128) NOT NULL,
          foto_ids text[] NOT NULL,
          rostos_detectados integer NOT NULL,
          cover_crop_url text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (evento_id, cluster_key)
        )`);
      await pool.query("CREATE INDEX IF NOT EXISTS face_index_faces_evento_idx ON face_index_faces (evento_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS face_index_clusters_evento_idx ON face_index_clusters (evento_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS face_index_faces_embedding_hnsw ON face_index_faces USING hnsw (embedding vector_l2_ops)");
      await pool.query("CREATE INDEX IF NOT EXISTS face_index_clusters_embedding_hnsw ON face_index_clusters USING hnsw (embedding vector_l2_ops)");
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
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
  await ensureSchema();

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
  await ensureSchema();

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
