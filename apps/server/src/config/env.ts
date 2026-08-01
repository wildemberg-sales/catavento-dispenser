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
  OPERATOR_ONLINE_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  // Maior que o intervalo de heartbeat do app do operador (60s, fixo no
  // client) — tolera perder 2 pings seguidos antes de considerar offline.
  OPERATOR_ONLINE_TIMEOUT_MINUTES: z.coerce.number().positive().default(3),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STORAGE_DRIVER: z.enum(["local", "memory"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.data/uploads"),
  STORAGE_PUBLIC_BASE_URL: z.string().default("http://localhost:3000/uploads"),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MAX_IMAGES_PER_PRODUCT: z.coerce.number().int().positive().default(8),
  ANALYTICS_MAX_RANGE_DAYS: z.coerce.number().int().positive().default(90),
  // Teto de linhas por importação — o upload em si já tem um limite de 20MB
  // (multipart.ts), mas um .xlsx é um zip: um arquivo pequeno pode se
  // descomprimir em milhões de linhas ("zip bomb"). ExcelJS não expõe uma
  // opção pra limitar isso durante o parse em si, então o teto é checado
  // logo após o parse, antes da iteração linha a linha mais custosa — reduz
  // a janela de exposição, não elimina o pico de memória do parse inicial.
  MAX_IMPORT_ROWS: z.coerce.number().int().positive().default(50000),
  // Login/refresh não tinham nenhum controle de tentativas — força bruta e
  // credential stuffing eram possíveis sem fricção nenhuma. Limite por IP.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  // Lista separada por vírgulas (ex.: "https://admin.exemplo.com,https://outra.com").
  // Vazio (default) mantém o comportamento de refletir qualquer origem —
  // aceitável pra uma ferramenta interna, mas deve ser restringido antes de
  // expor a API fora da rede local.
  CORS_ALLOWED_ORIGINS: z.string().default(""),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(source);
}
