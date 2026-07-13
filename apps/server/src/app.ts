import fastify, { type FastifyInstance } from "fastify";
import type { DbInstance } from "@catavento/db";
import type { Config } from "./config/env.js";
import type { StoragePort } from "./lib/storage/storage.port.js";
import { buildLoggerOptions } from "./lib/logger.js";
import sensiblePlugin from "./plugins/sensible.js";
import jwtPlugin from "./plugins/jwt.js";
import dbPlugin from "./plugins/db.js";
import configPlugin from "./plugins/config.js";
import storagePlugin from "./plugins/storage.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import multipartPlugin from "./plugins/multipart.js";
import authRoutes from "./modules/auth/auth.routes.js";
import queueRoutes from "./modules/queue/queue.routes.js";
import adminQueueRoutes from "./modules/queue/admin-queue.routes.js";
import importsRoutes from "./modules/imports/imports.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import monitorRoutes from "./modules/monitor/monitor.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

export async function buildApp(opts: {
  db: DbInstance;
  config: Config;
  storage: StoragePort;
}): Promise<FastifyInstance> {
  const app = fastify({ logger: buildLoggerOptions(opts.config) });

  await app.register(sensiblePlugin);
  await app.register(jwtPlugin, { config: opts.config });
  await app.register(dbPlugin, { db: opts.db });
  await app.register(configPlugin, { config: opts.config });
  await app.register(storagePlugin, { storage: opts.storage });
  await app.register(multipartPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(queueRoutes, { prefix: "/queue" });
  await app.register(adminQueueRoutes, { prefix: "/admin/queue" });
  await app.register(importsRoutes, { prefix: "/admin/imports" });
  await app.register(usersRoutes, { prefix: "/admin/users" });
  await app.register(productsRoutes, { prefix: "/admin/products" });
  await app.register(monitorRoutes, { prefix: "/admin" });
  await app.register(analyticsRoutes, { prefix: "/admin" });

  return app;
}
