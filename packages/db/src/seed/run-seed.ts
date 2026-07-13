import { createDbPool } from "../client.js";
import { seed } from "./seed.js";

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
