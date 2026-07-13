export * from "./storage.port.js";
export * from "./in-memory.adapter.js";
export * from "./local-fs.adapter.js";

import type { Config } from "../../config/env.js";
import type { StoragePort } from "./storage.port.js";
import { createInMemoryStorage } from "./in-memory.adapter.js";
import { createLocalFsStorage } from "./local-fs.adapter.js";

export function createStorage(config: Config): StoragePort {
  if (config.STORAGE_DRIVER === "memory") {
    return createInMemoryStorage();
  }
  return createLocalFsStorage({
    baseDir: config.STORAGE_LOCAL_DIR,
    publicBaseUrl: config.STORAGE_PUBLIC_BASE_URL,
  });
}
