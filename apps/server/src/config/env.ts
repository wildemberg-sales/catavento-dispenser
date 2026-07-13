import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PGPOOL_MAX: z.coerce.number().int().positive().default(10),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  ABANDONMENT_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  ABANDONMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STORAGE_DRIVER: z.enum(["local", "memory"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.data/uploads"),
  STORAGE_PUBLIC_BASE_URL: z.string().default("http://localhost:3000/uploads"),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MAX_IMAGES_PER_PRODUCT: z.coerce.number().int().positive().default(8),
  ANALYTICS_MAX_RANGE_DAYS: z.coerce.number().int().positive().default(90),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(source);
}
