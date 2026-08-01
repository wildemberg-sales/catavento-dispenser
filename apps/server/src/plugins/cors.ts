import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { Config } from "../config/env.js";
import { parseAllowedOrigins } from "../lib/cors-origins.js";

// Ferramenta interna (app de gerência via Electron/Chromium) — sem
// CORS_ALLOWED_ORIGINS configurada, reflete qualquer origem (não há usuário
// final de terceiros batendo nesta API hoje). Definir a env var restringe a
// uma allowlist fixa, recomendado antes de expor a API fora da rede local.
export default fp(async (app, opts: { config: Config }) => {
  const allowedOrigins = parseAllowedOrigins(opts.config.CORS_ALLOWED_ORIGINS);
  await app.register(cors, { origin: allowedOrigins ?? true });
});
