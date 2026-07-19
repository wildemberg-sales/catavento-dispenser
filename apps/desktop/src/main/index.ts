import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerSecureStoreHandlers } from "./secureStore.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Sem isso, o Electron cai no nome genérico "Electron" para a pasta de
// userData (onde o secure-store.json fica) em vez de um nome próprio do app.
app.setName("Catavento Gerência");

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once("ready-to-show", () => window.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  registerSecureStoreHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
