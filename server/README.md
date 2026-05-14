# Galeria Contourline — Face Server

Servidor Node.js para indexação facial em background.
Roda no Render (free tier) e é chamado pelo site Next.js.

## Stack

- Node.js 20+
- Express
- `@vladmandic/face-api` + `@tensorflow/tfjs-node` (TF nativo)
- `canvas` (polyfill de imagem pra Node)
- Modelos: TinyFaceDetector + FaceLandmark68Tiny + FaceRecognition

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check (Render usa) |
| POST | `/indexar` | Inicia job de indexação (responde imediato) |
| GET | `/status/:jobId` | Consulta progresso |

Auth: header `X-Server-Secret` deve bater com env `SERVER_SECRET`.

## Body do POST /indexar

```json
{
  "eventoId": "evento_123",
  "eventoNome": "Festa 2024",
  "folderId": "ID_da_pasta_Drive",
  "perfis": [
    {
      "email": "user@example.com",
      "nome": "Fulano",
      "descriptors": [[...128 nums...], [...128 nums...]],
      "thumb": "https://..."
    }
  ]
}
```

Resposta:
```json
{ "jobId": "evento_123_1716742800123", "status": "started" }
```

## Resposta /status/:jobId

```json
{
  "jobId": "evento_123_...",
  "status": "running" | "done" | "error",
  "fase": "detectando_rostos" | "fazendo_matches" | ...,
  "fotosProcessadas": 120,
  "fotosTotal": 450,
  "fotosComRosto": 95,
  "rostosDetectados": 180,
  "matches": 12,
  "erro": null
}
```

## Deploy no Render

1. Push pro GitHub
2. No Render: New → Web Service → conecta repo
3. Em "Root Directory": `server`
4. Build: `npm install` | Start: `npm start`
5. Adiciona env vars (ver `.env.example`)
6. Deploy

## Rodar local

```bash
cd server
cp .env.example .env
# Edita .env com suas creds
npm install
npm start
```
