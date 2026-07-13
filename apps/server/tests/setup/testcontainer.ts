import path from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { schema } from "@catavento/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  __dirname,
  "../../../../packages/db/migrations"
);

export type TestDbContext = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
};

export async function startTestDb(opts?: { max?: number }): Promise<TestDbContext> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const pool = new Pool({ connectionString: container.getConnectionUri(), max: opts?.max ?? 20 });
  // Sem este listener, um erro em background num cliente ocioso (comum ao
  // parar o container no teardown) derruba o processo de teste inteiro com
  // uma exceção não tratada — mesmo com todas as asserções já passadas.
  pool.on("error", () => {});
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { container, pool, db };
}

export async function stopTestDb(ctx: TestDbContext): Promise<void> {
  await ctx.pool.end();
  await ctx.container.stop();
}

export async function truncateAll(db: TestDbContext["db"]): Promise<void> {
  // queue_priority_rules NÃO é truncada aqui: é configuração global de baixa
  // cardinalidade semeada pela migration, não dado transacional por teste.
  // Testes que precisam de um estado específico usam a factory
  // `setPriorityRules` (upsert), não TRUNCATE.
  await db.execute(sql`
    TRUNCATE TABLE work_logs, queue_items, import_batch_rows, import_batches,
      product_images, product_skus, products, refresh_tokens, users
      RESTART IDENTITY CASCADE
  `);
}
