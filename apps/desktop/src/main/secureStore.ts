import { app, ipcMain, safeStorage } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SafeStorageLike = {
  isEncryptionAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (buffer: Buffer) => string;
};

type FsLike = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => string;
  writeFileSync: (path: string, data: string) => void;
};

export function createSecureStoreHandlers(deps: { safeStorage: SafeStorageLike; storePath: string; fs: FsLike }) {
  const { safeStorage: storage, storePath, fs } = deps;

  function readBlob(): Record<string, string> {
    if (!fs.existsSync(storePath)) return {};
    return JSON.parse(fs.readFileSync(storePath)) as Record<string, string>;
  }

  function writeBlob(blob: Record<string, string>): void {
    fs.writeFileSync(storePath, JSON.stringify(blob));
  }

  return {
    get(key: string): string | null {
      if (!storage.isEncryptionAvailable()) return null;
      const blob = readBlob();
      const encrypted = blob[key];
      if (!encrypted) return null;
      return storage.decryptString(Buffer.from(encrypted, "base64"));
    },

    set(key: string, value: string): void {
      if (!storage.isEncryptionAvailable()) return;
      const blob = readBlob();
      blob[key] = storage.encryptString(value).toString("base64");
      writeBlob(blob);
    },

    delete(key: string): void {
      const blob = readBlob();
      delete blob[key];
      writeBlob(blob);
    },
  };
}

/* v8 ignore start -- wiring de Electron real (app/ipcMain/safeStorage), coberto pelo e2e Playwright, não por unidade */
export function registerSecureStoreHandlers(): void {
  const handlers = createSecureStoreHandlers({
    safeStorage,
    storePath: join(app.getPath("userData"), "secure-store.json"),
    fs: { existsSync, readFileSync: (path) => readFileSync(path, "utf-8"), writeFileSync },
  });

  ipcMain.handle("secure-store:get", (_event, key: string) => handlers.get(key));
  ipcMain.handle("secure-store:set", (_event, key: string, value: string) => handlers.set(key, value));
  ipcMain.handle("secure-store:delete", (_event, key: string) => handlers.delete(key));
}
/* v8 ignore stop */
