import fp from "fastify-plugin";
import type { StoragePort } from "../lib/storage/storage.port.js";

export default fp(async (app, opts: { storage: StoragePort }) => {
  app.decorate("storage", opts.storage);
});
