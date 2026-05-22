import pg from "pg";

const { Pool } = pg;
const VECTOR_SIZE = 128;
let pool;
let schemaReady;

export function faceIndexDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query("CREATE EXTENSION IF NOT EXISTS vector");
      await db.query(`
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
      await db.query(`
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
      await db.query(`
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
      await db.query("CREATE INDEX IF NOT EXISTS face_index_faces_evento_idx ON face_index_faces (evento_id)");
      await db.query("CREATE INDEX IF NOT EXISTS face_index_clusters_evento_idx ON face_index_clusters (evento_id)");
      await db.query("CREATE INDEX IF NOT EXISTS face_index_faces_embedding_hnsw ON face_index_faces USING hnsw (embedding vector_l2_ops)");
      await db.query("CREATE INDEX IF NOT EXISTS face_index_clusters_embedding_hnsw ON face_index_clusters USING hnsw (embedding vector_l2_ops)");
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function toVector(value) {
  if (!Array.isArray(value) || value.length !== VECTOR_SIZE) {
    throw new Error(`Descriptor facial precisa ter ${VECTOR_SIZE} valores`);
  }
  return `[${value.map((n) => Number(n).toString()).join(",")}]`;
}

export async function substituirIndiceEvento({
  eventoId,
  eventoNome,
  folderId,
  descriptors,
  clusters,
  totalFotos,
  fotosComRosto,
  rostosDetectados,
}) {
  const db = getPool();
  if (!db) return false;
  await ensureSchema();

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO face_index_events (
         evento_id, evento_nome, drive_folder_id, total_fotos, fotos_com_rosto,
         rostos_detectados, status, indexed_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'ready', now(), now())
       ON CONFLICT (evento_id) DO UPDATE SET
         evento_nome = EXCLUDED.evento_nome,
         drive_folder_id = EXCLUDED.drive_folder_id,
         total_fotos = EXCLUDED.total_fotos,
         fotos_com_rosto = EXCLUDED.fotos_com_rosto,
         rostos_detectados = EXCLUDED.rostos_detectados,
         status = EXCLUDED.status,
         indexed_at = now(),
         updated_at = now()`,
      [eventoId, eventoNome, folderId, totalFotos, fotosComRosto, rostosDetectados]
    );

    await client.query("DELETE FROM face_index_faces WHERE evento_id = $1", [eventoId]);
    await client.query("DELETE FROM face_index_clusters WHERE evento_id = $1", [eventoId]);

    for (const foto of descriptors) {
      for (const [faceOrdem, rosto] of (foto.rostos || []).entries()) {
        if (!Array.isArray(rosto.descriptor) || rosto.descriptor.length !== VECTOR_SIZE) continue;
        const box = rosto.box || {};
        await client.query(
          `INSERT INTO face_index_faces (
             evento_id, foto_id, face_ordem, embedding, box_x, box_y,
             box_width, box_height, detection_score
           ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9)`,
          [
            eventoId,
            foto.fotoId,
            faceOrdem,
            toVector(rosto.descriptor),
            box.x ?? null,
            box.y ?? null,
            box.width ?? null,
            box.height ?? null,
            rosto.score ?? null,
          ]
        );
      }
    }

    for (const cluster of clusters) {
      if (!Array.isArray(cluster.descritor_medio) || cluster.descritor_medio.length !== VECTOR_SIZE) continue;
      await client.query(
        `INSERT INTO face_index_clusters (
           evento_id, cluster_key, embedding, foto_ids, rostos_detectados
         ) VALUES ($1, $2, $3::vector, $4::text[], $5)`,
        [
          eventoId,
          cluster.clusterId,
          toVector(cluster.descritor_medio),
          cluster.fotos || [],
          cluster.rostosDetectados || 0,
        ]
      );
    }

    await client.query("COMMIT");
    console.log(
      `[pgvector] Indice salvo: ${eventoId}, ${descriptors.length} fotos, ${clusters.length} clusters`
    );
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    console.warn(`[pgvector] Falha ao salvar indice de ${eventoId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

export async function lerPreviewIndiceEvento(eventoId, limit = 12) {
  const db = getPool();
  if (!db) return null;
  await ensureSchema();

  const result = await db.query(
    `WITH fotos_amostra AS (
       SELECT foto_id, min(id) AS first_face_id
         FROM face_index_faces
        WHERE evento_id = $1
        GROUP BY foto_id
        ORDER BY min(id) DESC
        LIMIT $2
     )
     SELECT f.id,
            f.foto_id,
            f.face_ordem,
            f.box_x,
            f.box_y,
            f.box_width,
            f.box_height,
            f.detection_score,
            e.total_fotos,
            e.fotos_com_rosto,
            e.rostos_detectados
       FROM fotos_amostra a
       JOIN face_index_faces f
         ON f.evento_id = $1 AND f.foto_id = a.foto_id
       JOIN face_index_events e
         ON e.evento_id = f.evento_id
      ORDER BY a.first_face_id DESC, f.face_ordem ASC`,
    [eventoId, Math.max(1, Math.min(Number(limit) || 12, 30))]
  );
  if (result.rows.length === 0) return null;

  const fotos = new Map();
  for (const row of result.rows) {
    const foto = fotos.get(row.foto_id) || { fotoId: row.foto_id, rostos: [] };
    foto.rostos.push({
      ordem: Number(row.face_ordem),
      score: row.detection_score === null ? null : Number(row.detection_score),
      box: {
        x: row.box_x === null ? null : Number(row.box_x),
        y: row.box_y === null ? null : Number(row.box_y),
        width: row.box_width === null ? null : Number(row.box_width),
        height: row.box_height === null ? null : Number(row.box_height),
      },
    });
    fotos.set(row.foto_id, foto);
  }

  const primeira = result.rows[0];
  return {
    totalFotos: Number(primeira.total_fotos) || 0,
    fotosComRosto: Number(primeira.fotos_com_rosto) || 0,
    rostosDetectados: Number(primeira.rostos_detectados) || 0,
    fotos: [...fotos.values()],
  };
}
