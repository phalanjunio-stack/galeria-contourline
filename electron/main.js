// Electron main process — splash + janela principal
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// URL do app — em dev aponta pra localhost, em produção pro deploy
const isDev = !app.isPackaged;
const APP_URL = isDev
  ? "http://localhost:3000"
  : process.env.APP_URL || "https://galeria-contourline.vercel.app";

// Tempo mínimo do splash (mesmo se carregar rápido) — pra não "piscar"
const SPLASH_MIN_MS = 1500;

let splashWindow = null;
let mainWindow   = null;

function criarSplash() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => { splashWindow = null; });
}

function criarMain() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,             // só mostra quando a página carregar
    backgroundColor: "#EFF5FF",
    icon: path.join(__dirname, "icons", "icon.png"),
    title: "Contourline",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(APP_URL);

  // Abre links externos (http(s)://outro-dominio) no browser padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const host   = new URL(APP_URL).hostname;
      if (target.hostname !== host) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch { /* ignora URL inválida */ }
    return { action: "allow" };
  });

  // Quando terminar de carregar (ou após SPLASH_MIN_MS) → mostra main + fecha splash
  const inicio = Date.now();
  mainWindow.webContents.once("did-finish-load", () => {
    const restante = SPLASH_MIN_MS - (Date.now() - inicio);
    setTimeout(() => {
      if (splashWindow) splashWindow.close();
      if (mainWindow)   mainWindow.show();
    }, Math.max(0, restante));
  });

  // Se demorar muito (>15s), mostra mesmo assim com um aviso
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      if (splashWindow) splashWindow.close();
      mainWindow.show();
    }
  }, 15000);

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  criarSplash();
  // Pequena defasagem pra splash aparecer antes do main começar a carregar
  setTimeout(criarMain, 200);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarSplash();
      criarMain();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
