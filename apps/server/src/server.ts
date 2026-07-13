import { createDbPool } from "@catavento/db";
import { loadConfig } from "./config/env.js";
import { buildApp } from "./app.js";
import { registerAbandonmentJob } from "./modules/queue/abandonment.job.js";
import { queueRepository } from "./modules/queue/queue.repository.js";
import { createStorage } from "./lib/storage/index.js";

async function main() {
  const config = loadConfig();
  const { db } = createDbPool(config.DATABASE_URL, { max: config.PGPOOL_MAX });
  const storage = createStorage(config);
  const app = await buildApp({ db, config, storage });

  registerAbandonmentJob(app, {
    intervalMs: config.ABANDONMENT_CHECK_INTERVAL_MS,
    timeoutMinutes: config.ABANDONMENT_TIMEOUT_MINUTES,
    abandonStale: (timeoutMinutes) => queueRepository(db).abandonStale(timeoutMinutes),
  });

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
