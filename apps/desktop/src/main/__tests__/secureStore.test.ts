import { describe, expect, it, vi } from "vitest";
import { createSecureStoreHandlers } from "../secureStore.js";

function createFakeFs(initialFiles: Record<string, string> = {}) {
  const files = new Map(Object.entries(initialFiles));
  return {
    existsSync: vi.fn((path: string) => files.has(path)),
    readFileSync: vi.fn((path: string) => files.get(path) ?? ""),
    writeFileSync: vi.fn((path: string, data: string) => {
      files.set(path, data);
    }),
    _files: files,
  };
}

function createFakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: vi.fn(() => available),
    encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`)),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString("utf-8").replace(/^enc:/, "")),
  };
}

describe("createSecureStoreHandlers", () => {
  const storePath = "/fake/userData/secure-store.json";

  it("get retorna null quando a chave nunca foi salva", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage();
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });

    expect(handlers.get("refreshToken")).toBeNull();
  });

  it("set grava criptografado e get devolve o valor original", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage();
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });

    handlers.set("refreshToken", "token-secreto");

    expect(safeStorage.encryptString).toHaveBeenCalledWith("token-secreto");
    expect(handlers.get("refreshToken")).toBe("token-secreto");
  });

  it("delete remove a chave; get volta a retornar null", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage();
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });
    handlers.set("refreshToken", "token-secreto");

    handlers.delete("refreshToken");

    expect(handlers.get("refreshToken")).toBeNull();
  });

  it("mantém outras chaves intactas ao salvar/remover uma chave específica", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage();
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });
    handlers.set("refreshToken", "token-1");
    handlers.set("outraChave", "valor-2");

    handlers.delete("refreshToken");

    expect(handlers.get("outraChave")).toBe("valor-2");
  });

  it("get retorna null quando a criptografia do SO não está disponível", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage(false);
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });

    expect(handlers.get("refreshToken")).toBeNull();
  });

  it("set não grava nada quando a criptografia do SO não está disponível", () => {
    const fs = createFakeFs();
    const safeStorage = createFakeSafeStorage(false);
    const handlers = createSecureStoreHandlers({ safeStorage, storePath, fs });

    handlers.set("refreshToken", "token-secreto");

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
