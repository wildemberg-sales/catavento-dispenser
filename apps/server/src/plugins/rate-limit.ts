import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "../config/env.js";

// Registrado com global:false — nada é limitado por padrão. As rotas de
// login/refresh (auth.routes.ts) aplicam esse mesmo limite explicitamente via
// `config: { rateLimit: {...} }`, já que só elas precisam de controle de
// tentativas (força bruta / credential stuffing).
export default fp(async (app, opts: { config: Config }) => {
  await app.register(rateLimit, {
    global: false,
    max: opts.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: opts.config.AUTH_RATE_LIMIT_WINDOW_MS,
  });
});
