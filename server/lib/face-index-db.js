import pg from "pg";

const { Pool } = pg;
const VECTOR_SIZE = 128;
let pool;

export function faceIndexDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
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
