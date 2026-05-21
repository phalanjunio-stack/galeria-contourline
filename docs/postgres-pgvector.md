# PostgreSQL + pgvector

O Google Drive continua guardando as fotos originais. O PostgreSQL guarda o
indice facial pesquisavel: vetores por rosto e centroides dos clusters de cada
evento.

## Easypanel

1. Crie um servico PostgreSQL com `pgvector` habilitado. Uma imagem baseada em
   `pgvector/pgvector` ja traz a extensao `vector`.
2. Configure a mesma `DATABASE_URL` no app Next.js e no face server.
3. Reindexe os eventos que precisam entrar na busca vetorial.

Sem `DATABASE_URL`, o app continua usando os JSONs de descritores e clusters
salvos no Drive ou em `data/descritores`.

O app e o face server criam a extensao `vector`, tabelas e indices na primeira
conexao com o banco. `db/face-index.sql` continua disponivel para instalacao
manual ou auditoria.

## Dados gravados

- `face_index_events`: status e contadores da ultima indexacao por evento.
- `face_index_faces`: descriptor de cada rosto detectado, foto do Drive e caixa
  do rosto dentro da thumbnail indexada.
- `face_index_clusters`: centroide vetorial e IDs de fotos de cada pessoa
  agrupada no evento.

O detector agora salva `box` e `score` junto do rosto. Isso permite criar
recortes WebP de rosto em uma proxima etapa sem mudar o contrato do indice.

## Busca

`POST /api/pessoas/buscar` recebe os descriptors do usuario e IDs de eventos,
consulta `face_index_clusters` com distancia L2 no `pgvector` e devolve os
clusters mais proximos. `/resultado` usa esse endpoint primeiro e preserva o
fallback antigo quando o banco ainda nao estiver pronto.
