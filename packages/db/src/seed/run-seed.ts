import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createDbPool } from "../client.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Carrega o .env da raiz do monorepo — ver o mesmo comentário em
// apps/server/src/server.ts.
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida");
  }
  const { pool, db } = createDbPool(databaseUrl);
  await seed(db);
  await pool.end();
  console.log("Seed aplicado com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
