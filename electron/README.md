# Contourline Desktop App

App Electron que abre o site `https://galeria-contourline.vercel.app` numa janela nativa com splash screen orbital.

## Setup (uma vez)

```bash
npm install
```

Vai puxar `electron`, `electron-builder`, `concurrently`, `wait-on`.

### Ícones (opcional — pode pular agora)

Copia o logo Contourline pra cá:

```
electron/icons/
├── icon.png   (512×512 — usado no splash, app icon Linux)
├── icon.ico   (Windows — múltiplos tamanhos 16,32,48,256)
└── icon.icns  (Mac)
```

Por enquanto: copia `public/logos/icon.png` pra `electron/icons/icon.png` que já cobre splash + Linux. Windows/Mac dão fallback feio mas funcionam.

> Comando rápido (PowerShell):
> ```powershell
> mkdir electron\icons
> copy public\logos\icon.png electron\icons\icon.png
> ```

## Rodar em desenvolvimento

**Opção A** — dois terminais (recomendado):

```bash
# terminal 1
npm run dev               # sobe Next em localhost:3000

# terminal 2
npm run desktop:dev       # abre janela Electron apontando pra localhost
```

**Opção B** — comando único (sobe Next + espera + abre Electron):

```bash
npm run desktop:dev:full
```

## Apontar pra produção

O app por padrão usa `https://galeria-contourline.vercel.app` quando empacotado.
Pra mudar, edita `APP_URL` em `electron/main.js`, ou define a env var:

```bash
APP_URL=https://meu-deploy.com npm run desktop:build
```

## Empacotar pra Windows (.exe)

```bash
npm run desktop:build:win
```

Sai um instalador NSIS em `dist-desktop/Contourline Setup X.X.X.exe`.
Instala normalmente, fica no Iniciar com ícone.

## Estrutura

```
electron/
├── main.js          ← processo principal (cria splash + janela)
├── splash.html      ← splash orbital (1.5s mínimo)
├── icons/           ← ícones do app (você adiciona)
└── README.md        ← este arquivo
```

## Como o splash funciona

1. App abre → cria splash (frame:false, transparent:true, 460×560, sempre no topo)
2. 200ms depois → cria janela principal (escondida) carregando `APP_URL`
3. Quando site termina de carregar → espera o mínimo de 1.5s passar → fecha splash + mostra principal
4. Se demorar mais de 15s → mostra principal mesmo (fallback)
