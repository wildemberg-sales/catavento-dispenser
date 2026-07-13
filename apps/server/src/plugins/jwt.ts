import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { Config } from "../config/env.js";

export default fp(async (app, opts: { config: Config }) => {
  const { config } = opts;

  await app.register(fastifyJwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.ACCESS_TOKEN_TTL },
  });

  await app.register(fastifyJwt, {
    secret: config.JWT_REFRESH_SECRET,
    namespace: "refresh",
    decoratorName: "refreshUser",
    sign: { expiresIn: config.REFRESH_TOKEN_TTL },
  });
});
