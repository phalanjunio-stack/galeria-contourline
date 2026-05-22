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

type DbIndexedFaceRow = {
  id: string | number;
  evento_id: string;
  evento_nome: string;
  foto_id: string;
  face_ordem: number;
  box_x: number | null;
  box_y: number | null;
  box_width: number | null;
  box_height: number | null;
  detection_score: number | null;
  total_fotos: number;
  fotos_com_rosto: number;
  rostos_detectados: number;
  indexed_at: Date | string;
};

type DbFaceCropRow = {
  id: string | number;
  foto_id: string;
  box_x: number | null;
  box_y: number | null;
  box_width: number | null;
  box_height: number | null;
};

type DbPhotoMatchRow = {
  evento_id: string;
  foto_id: string;
  distance?: number | string;
};

export interface ClusterMatchDb {
  eventoId: string;
  cluster: ClusterPessoa;
  dist: number;
}

export interface FacePhotoMatchDb {
  eventoId: string;
  fotoId: string;
  dist: number;
}

export interface FaceIndexPreviewFace {
  id: string;
  ordem: number;
  score: number | null;
  cropUrl: string;
}

export interface FaceIndexPreviewPhoto {
  fotoId: string;
  rostos: FaceIndexPreviewFace[];
}

export interface FaceIndexPreview {
  eventoId: string;
  eventoNome: string;
  totalFotos: number;
  fotosComRosto: number;
  rostosDetectados: number;
  indexedAt: string;
  fotos: FaceIndexPreviewPhoto[];
}

export interface FaceIndexDbStatus {
  configured: boolean;
  ok: boolean;
  eventosIndexados: number;
  rostosIndexados: number;
  ultimoIndice: string | null;
  erro?: string;
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

export async function lerAmostraRostosIndexadosDb(eventoId: string, limit = 12) {
  const pool = getPool();
  if (!pool) return null;
  await ensureSchema();

  const result = await pool.query<DbIndexedFaceRow>(
    `WITH fotos_amostra AS (
       SELECT foto_id, min(id) AS first_face_id
         FROM face_index_faces
        WHERE evento_id = $1
        GROUP BY foto_id
        ORDER BY min(id) DESC
        LIMIT $2
     )
     SELECT f.id,
            f.evento_id,
            e.evento_nome,
            f.foto_id,
            f.face_ordem,
            f.box_x,
            f.box_y,
            f.box_width,
            f.box_height,
            f.detection_score,
            e.total_fotos,
            e.fotos_com_rosto,
            e.rostos_detectados,
            e.indexed_at
       FROM fotos_amostra a
       JOIN face_index_faces f
         ON f.evento_id = $1 AND f.foto_id = a.foto_id
       JOIN face_index_events e
         ON e.evento_id = f.evento_id
      ORDER BY a.first_face_id DESC, f.face_ordem ASC`,
    [eventoId, Math.max(1, Math.min(limit, 30))]
  );
  if (result.rows.length === 0) return null;

  const primeira = result.rows[0];
  const fotos = new Map<string, FaceIndexPreviewPhoto>();
  for (const row of result.rows) {
    const foto = fotos.get(row.foto_id) ?? { fotoId: row.foto_id, rostos: [] };
    foto.rostos.push({
      id: String(row.id),
      ordem: Number(row.face_ordem),
      score: row.detection_score === null ? null : Number(row.detection_score),
      cropUrl: `/api/indexacao/rostos/crop?id=${encodeURIComponent(String(row.id))}`,
    });
    fotos.set(row.foto_id, foto);
  }

  return {
    eventoId: primeira.evento_id,
    eventoNome: primeira.evento_nome,
    totalFotos: Number(primeira.total_fotos) || 0,
    fotosComRosto: Number(primeira.fotos_com_rosto) || 0,
    rostosDetectados: Number(primeira.rostos_detectados) || 0,
    indexedAt: new Date(primeira.indexed_at).toISOString(),
    fotos: [...fotos.values()],
  } satisfies FaceIndexPreview;
}

export async function lerRostoIndexadoDb(faceId: string) {
  const pool = getPool();
  if (!pool) return null;
  await ensureSchema();

  const result = await pool.query<DbFaceCropRow>(
    `SELECT id, foto_id, box_x, box_y, box_width, box_height
       FROM face_index_faces
      WHERE id = $1
      LIMIT 1`,
    [faceId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    fotoId: row.foto_id,
    box: {
      x: row.box_x === null ? null : Number(row.box_x),
      y: row.box_y === null ? null : Number(row.box_y),
      width: row.box_width === null ? null : Number(row.box_width),
      height: row.box_height === null ? null : Number(row.box_height),
    },
  };
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

export async function buscarFotosPorRostoDb({
  eventoIds,
  descriptors,
  limit = 240,
  threshold = 0.55,
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

  const melhores = new Map<string, FacePhotoMatchDb>();
  for (const descriptor of validDescriptors) {
    const result = await pool.query<DbPhotoMatchRow>(
      `SELECT evento_id,
              foto_id,
              min(embedding <-> $1::vector) AS distance
         FROM face_index_faces
        WHERE evento_id = ANY($2::text[])
          AND embedding <-> $1::vector < $3
        GROUP BY evento_id, foto_id
        ORDER BY distance ASC
        LIMIT $4`,
      [toVector(descriptor), eventoIds, threshold, Math.max(1, Math.min(limit, 1000))]
    );

    for (const row of result.rows) {
      const dist = Number(row.distance);
      const key = `${row.evento_id}:${row.foto_id}`;
      const anterior = melhores.get(key);
      if (!anterior || dist < anterior.dist) {
        melhores.set(key, {
          eventoId: row.evento_id,
          fotoId: row.foto_id,
          dist,
        });
      }
    }
  }

  return [...melhores.values()]
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.max(1, Math.min(limit, 1000)));
}

export async function lerStatusFaceIndexDb(): Promise<FaceIndexDbStatus> {
  const pool = getPool();
  if (!pool) {
    return {
      configured: false,
      ok: false,
      eventosIndexados: 0,
      rostosIndexados: 0,
      ultimoIndice: null,
    };
  }

  try {
    await ensureSchema();
    const result = await pool.query<{
      eventos_indexados: string | number;
      rostos_indexados: string | number;
      ultimo_indice: Date | string | null;
    }>(
      `SELECT count(*) AS eventos_indexados,
              coalesce(sum(rostos_detectados), 0) AS rostos_indexados,
              max(indexed_at) AS ultimo_indice
         FROM face_index_events`
    );
    const row = result.rows[0];
    return {
      configured: true,
      ok: true,
      eventosIndexados: Number(row?.eventos_indexados) || 0,
      rostosIndexados: Number(row?.rostos_indexados) || 0,
      ultimoIndice: row?.ultimo_indice ? new Date(row.ultimo_indice).toISOString() : null,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      eventosIndexados: 0,
      rostosIndexados: 0,
      ultimoIndice: null,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}
