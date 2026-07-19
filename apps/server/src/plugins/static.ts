import { resolve } from "node:path";
import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";

export default fp(async (app) => {
  if (app.config.STORAGE_DRIVER !== "local") return;

  await app.register(fastifyStatic, {
    root: resolve(app.config.STORAGE_LOCAL_DIR),
    prefix: "/uploads/",
  });
});
