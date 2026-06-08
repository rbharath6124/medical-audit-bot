const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("medAudit", {
  selectStorageFolder: () => ipcRenderer.invoke("medaudit:select-storage-folder"),
  readAudits: (folder) => ipcRenderer.invoke("medaudit:read-audits", folder),
  writeAudits: (folder, audits) => ipcRenderer.invoke("medaudit:write-audits", folder, audits),
  clearAudits: (folder) => ipcRenderer.invoke("medaudit:clear-audits", folder),
});
