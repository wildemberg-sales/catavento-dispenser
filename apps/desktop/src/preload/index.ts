import { contextBridge, ipcRenderer } from "electron";

const secureStore = {
  get: (key: string): Promise<string | null> => ipcRenderer.invoke("secure-store:get", key),
  set: (key: string, value: string): Promise<void> => ipcRenderer.invoke("secure-store:set", key, value),
  delete: (key: string): Promise<void> => ipcRenderer.invoke("secure-store:delete", key),
};

contextBridge.exposeInMainWorld("catavento", { secureStore });

export type CataventoBridge = { secureStore: typeof secureStore };
