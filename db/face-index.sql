CREATE EXTENSION IF NOT EXISTS vector;

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
);

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
);

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
);

CREATE INDEX IF NOT EXISTS face_index_faces_evento_idx
  ON face_index_faces (evento_id);

CREATE INDEX IF NOT EXISTS face_index_clusters_evento_idx
  ON face_index_clusters (evento_id);

CREATE INDEX IF NOT EXISTS face_index_faces_embedding_hnsw
  ON face_index_faces USING hnsw (embedding vector_l2_ops);

CREATE INDEX IF NOT EXISTS face_index_clusters_embedding_hnsw
  ON face_index_clusters USING hnsw (embedding vector_l2_ops);
