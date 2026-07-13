import fp from "fastify-plugin";
import type { Config } from "../config/env.js";

export default fp(async (app, opts: { config: Config }) => {
  app.decorate("config", opts.config);
});
