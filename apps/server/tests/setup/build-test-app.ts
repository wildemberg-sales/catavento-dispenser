import type { DbInstance } from "@catavento/db";
import { buildApp } from "../../src/app.js";
import type { Config } from "../../src/config/env.js";
import { createInMemoryStorage } from "../../src/lib/storage/in-memory.adapter.js";
import type { StoragePort } from "../../src/lib/storage/storage.port.js";

export function buildTestConfig(overrides?: Partial<Config>): Config {
  return {
    DATABASE_URL: "postgres://unused-in-tests",
    PGPOOL_MAX: 20,
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "7d",
    ABANDONMENT_CHECK_INTERVAL_MS: 60000,
    ABANDONMENT_TIMEOUT_MINUTES: 15,
    PORT: 0,
    LOG_LEVEL: "error",
    STORAGE_DRIVER: "memory",
    STORAGE_LOCAL_DIR: "./.data/uploads-test",
    STORAGE_PUBLIC_BASE_URL: "http://localhost:3000/uploads",
    MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
    MAX_IMAGES_PER_PRODUCT: 8,
    ANALYTICS_MAX_RANGE_DAYS: 90,
    ...overrides,
  };
}

export async function buildTestApp(
  db: DbInstance,
  overrides?: Partial<Config>,
  storage: StoragePort = createInMemoryStorage()
) {
  const config = buildTestConfig(overrides);
  return buildApp({ db: db as DbInstance, config, storage });
}
