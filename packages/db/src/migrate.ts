import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDbPool } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida");
  }
  const { pool, db } = createDbPool(databaseUrl);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../migrations") });
  await pool.end();
  console.log("Migrations aplicadas com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
