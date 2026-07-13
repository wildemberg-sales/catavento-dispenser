import fp from "fastify-plugin";
import type { DbInstance } from "@catavento/db";

export default fp(async (app, opts: { db: DbInstance }) => {
  app.decorate("db", opts.db);
});
