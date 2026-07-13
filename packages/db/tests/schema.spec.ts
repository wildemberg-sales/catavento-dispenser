import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../src/schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

const EXPECTED_TABLES = [
  "users",
  "import_batches",
  "import_batch_rows",
  "products",
  "product_skus",
  "product_images",
  "queue_items",
  "work_logs",
  "refresh_tokens",
  "queue_priority_rules",
];

describe("db schema", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    pool.on("error", () => {});
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });
  }, 60000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it("cria todas as tabelas esperadas", async () => {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableNames = result.rows.map((row) => row.table_name as string);
    for (const expected of EXPECTED_TABLES) {
      expect(tableNames).toContain(expected);
    }
  });

  it("queue_items tem as colunas source, priority, sequence e status", async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'queue_items'
    `);
    const columnNames = result.rows.map((row) => row.column_name as string);
    expect(columnNames).toEqual(
      expect.arrayContaining(["source", "priority", "sequence", "status", "external_ref"])
    );
  });

  it("existe índice de dequeue cobrindo (status, priority, sequence)", async () => {
    const result = await db.execute(sql`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'queue_items'
    `);
    const defs = result.rows.map((row) => row.indexdef as string);
    const hasDequeueIndex = defs.some(
      (def) => def.includes("status") && def.includes("priority") && def.includes("sequence")
    );
    expect(hasDequeueIndex).toBe(true);
  });

  it("existem índices únicos parciais garantindo um único work_log ativo por item e por operador", async () => {
    const result = await db.execute(sql`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'work_logs'
    `);
    const defs = result.rows.map((row) => row.indexdef as string);
    const partialUniqueIndexes = defs.filter(
      (def) => def.includes("UNIQUE") && def.includes("WHERE (completed_at IS NULL)")
    );
    expect(partialUniqueIndexes.length).toBe(2);
  });

  it("product_skus é único por (source, sku) mas permite o mesmo sku em fontes diferentes", async () => {
    const [product] = await db
      .insert(schema.products)
      .values({ name: "Produto Teste" })
      .returning();

    await db.insert(schema.productSkus).values({
      productId: product!.id,
      source: "mercado_livre",
      sku: "ABC123",
    });

    await expect(
      db.insert(schema.productSkus).values({
        productId: product!.id,
        source: "mercado_livre",
        sku: "ABC123",
      })
    ).rejects.toThrow();

    await expect(
      db.insert(schema.productSkus).values({
        productId: product!.id,
        source: "shopee",
        sku: "ABC123",
      })
    ).resolves.not.toThrow();
  });

  it("rodar as migrations uma segunda vez é idempotente", async () => {
    await expect(migrate(db, { migrationsFolder })).resolves.not.toThrow();
  });

  it("queue_priority_rules já vem semeada com as 3 fontes após a migration", async () => {
    const rows = await db.select().from(schema.queuePriorityRules);
    expect(rows).toHaveLength(3);
    const bySource = Object.fromEntries(rows.map((r) => [r.source, r.priority]));
    expect(bySource.mercado_livre).toBe(2);
    expect(bySource.shopee).toBe(1);
    expect(bySource.ebay).toBe(0);
  });

  it("queue_priority_rules tem unique constraint em source", async () => {
    await expect(
      db.insert(schema.queuePriorityRules).values({ source: "mercado_livre", priority: 99 })
    ).rejects.toThrow();
  });

  it("work_log_outcome enum contém o valor 'cancelled'", async () => {
    const result = await db.execute(sql`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'work_log_outcome'
    `);
    const labels = result.rows.map((row) => row.enumlabel as string);
    expect(labels).toContain("cancelled");
  });

  it("import_batch_rows referencia import_batches e tem as colunas esperadas", async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'import_batch_rows'
    `);
    const columnNames = result.rows.map((row) => row.column_name as string);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "batch_id", "row_number", "raw_data", "external_ref", "source",
        "priority", "payload", "is_valid", "rejection_reason",
      ])
    );
  });

  it("extensão pg_trgm está instalada e há índice GIN trigram em products.name", async () => {
    const ext = await db.execute(sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`);
    expect(ext.rows).toHaveLength(1);

    const indexes = await db.execute(sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'products'`);
    const defs = indexes.rows.map((row) => row.indexdef as string);
    expect(defs.some((def) => def.includes("gin") && def.includes("gin_trgm_ops"))).toBe(true);
  });

  it("product_skus tem unique constraint em (product_id, source) — mesmo produto não pode ter 2 SKUs da mesma fonte", async () => {
    const [product] = await db.insert(schema.products).values({ name: "Produto Unique Test" }).returning();
    await db.insert(schema.productSkus).values({ productId: product!.id, source: "shopee", sku: "SKU-A" });
    await expect(
      db.insert(schema.productSkus).values({ productId: product!.id, source: "shopee", sku: "SKU-B" })
    ).rejects.toThrow();
  });

  it("existe índice em work_logs.completed_at (usado pelas agregações de throughput da Fase 6)", async () => {
    const result = await db.execute(sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'work_logs'`);
    const defs = result.rows.map((row) => row.indexdef as string);
    expect(defs.some((def) => def.includes("completed_at") && !def.includes("WHERE"))).toBe(true);
  });
});
