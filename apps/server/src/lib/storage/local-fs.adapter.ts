import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoragePort, StoredObjectMeta } from "./storage.port.js";

export function createLocalFsStorage(opts: { baseDir: string; publicBaseUrl: string }): StoragePort {
  function urlFor(key: string): string {
    return `${opts.publicBaseUrl}/${key}`;
  }

  return {
    async upload(params) {
      const filePath = path.join(opts.baseDir, params.key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, params.body);
      const meta: StoredObjectMeta = {
        key: params.key,
        url: urlFor(params.key),
        size: params.body.length,
        contentType: params.contentType,
      };
      return meta;
    },

    async delete(key) {
      await rm(path.join(opts.baseDir, key), { force: true });
    },

    async getUrl(key) {
      return urlFor(key);
    },
  };
}
