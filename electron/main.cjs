const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = Boolean(process.env.ELECTRON_START_URL);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

function dbPath(folder) {
  return path.join(folder, "medaudit-db.json");
}

ipcMain.handle("medaudit:select-storage-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose audit database folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("medaudit:read-audits", async (_event, folder) => {
  if (!folder || typeof folder !== "string") return null;
  try {
    const raw = await fs.promises.readFile(dbPath(folder), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.audits) ? parsed.audits : [];
  } catch (e) {
    if (e && e.code === "ENOENT") return [];
    throw e;
  }
});

ipcMain.handle("medaudit:write-audits", async (_event, folder, audits) => {
  if (!folder || typeof folder !== "string") return false;
  await fs.promises.mkdir(folder, { recursive: true });
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    audits: Array.isArray(audits) ? audits : [],
  };
  await fs.promises.writeFile(dbPath(folder), JSON.stringify(payload, null, 2), "utf8");
  return true;
});

ipcMain.handle("medaudit:clear-audits", async (_event, folder) => {
  if (!folder || typeof folder !== "string") return false;
  try {
    await fs.promises.unlink(dbPath(folder));
  } catch (e) {
    if (!e || e.code !== "ENOENT") throw e;
  }
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
