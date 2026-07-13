import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInMemoryStorage } from "../../src/lib/storage/in-memory.adapter.js";
import { createLocalFsStorage } from "../../src/lib/storage/local-fs.adapter.js";

describe("createInMemoryStorage", () => {
  it("upload retorna key/url/size/contentType, e getUrl retorna a mesma url", async () => {
    const storage = createInMemoryStorage();
    const meta = await storage.upload({ key: "produtos/1/foto.png", body: Buffer.from("dados"), contentType: "image/png" });
    expect(meta.key).toBe("produtos/1/foto.png");
    expect(meta.url).toContain("produtos/1/foto.png");
    expect(meta.size).toBe(5);

    const url = await storage.getUrl("produtos/1/foto.png");
    expect(url).toBe(meta.url);
  });

  it("delete de chave inexistente não lança erro (idempotência)", async () => {
    const storage = createInMemoryStorage();
    await expect(storage.delete("nao-existe")).resolves.not.toThrow();
  });

  it("delete remove o arquivo do storage", async () => {
    const storage = createInMemoryStorage();
    await storage.upload({ key: "x", body: Buffer.from("a"), contentType: "text/plain" });
    await storage.delete("x");
    expect(storage._files.has("x")).toBe(false);
  });
});

describe("createLocalFsStorage", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "catavento-storage-"));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("upload grava o arquivo em disco e retorna a url pública", async () => {
    const storage = createLocalFsStorage({ baseDir, publicBaseUrl: "http://localhost:3000/uploads" });
    const meta = await storage.upload({ key: "produtos/1/foto.png", body: Buffer.from("dados"), contentType: "image/png" });
    expect(meta.url).toBe("http://localhost:3000/uploads/produtos/1/foto.png");

    const written = await readFile(path.join(baseDir, "produtos/1/foto.png"));
    expect(written.toString()).toBe("dados");
  });

  it("delete de chave inexistente não lança erro", async () => {
    const storage = createLocalFsStorage({ baseDir, publicBaseUrl: "http://localhost:3000/uploads" });
    await expect(storage.delete("nao-existe.png")).resolves.not.toThrow();
  });

  it("getUrl retorna a mesma url do upload", async () => {
    const storage = createLocalFsStorage({ baseDir, publicBaseUrl: "http://localhost:3000/uploads" });
    await storage.upload({ key: "a/b.png", body: Buffer.from("x"), contentType: "image/png" });
    await expect(storage.getUrl("a/b.png")).resolves.toBe("http://localhost:3000/uploads/a/b.png");
  });
});
