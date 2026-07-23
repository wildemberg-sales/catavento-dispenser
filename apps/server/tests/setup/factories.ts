import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { schema } from "@catavento/db";
import type { TestDbContext } from "./testcontainer.js";

type Db = TestDbContext["db"];

// Hash Argon2id fixo, gerado uma única vez, reutilizado por todas as
// factories — evita pagar o custo de Argon2id em cada `createUser()`.
let cachedPasswordHash: string | undefined;
async function getTestPasswordHash(): Promise<string> {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await argon2.hash("senha-de-teste-123", { type: argon2.argon2id });
  }
  return cachedPasswordHash;
}

export async function createUser(
  db: Db,
  overrides?: Partial<{
    username: string;
    role: "admin" | "operator";
    displayName: string;
    isActive: boolean;
    passwordHash: string;
  }>
) {
  const passwordHash = overrides?.passwordHash ?? (await getTestPasswordHash());
  const [user] = await db
    .insert(schema.users)
    .values({
      username: overrides?.username ?? `user-${crypto.randomUUID()}`,
      passwordHash,
      role: overrides?.role ?? "operator",
      displayName: overrides?.displayName ?? "Usuário de Teste",
      isActive: overrides?.isActive ?? true,
    })
    .returning();
  return user!;
}

export async function createImportBatch(
  db: Db,
  overrides?: Partial<{ filename: string; sourceType: "csv" | "xlsx" }>
) {
  const [batch] = await db
    .insert(schema.importBatches)
    .values({
      filename: overrides?.filename ?? "lote-teste.csv",
      sourceType: overrides?.sourceType ?? "csv",
      status: "ready",
    })
    .returning();
  return batch!;
}

export async function createQueueItem(
  db: Db,
  overrides: {
    batchId: string;
    status?: "pending" | "in_progress" | "completed" | "cancelled" | "problem";
    priority?: number;
    source?: "mercado_livre" | "shopee" | "ebay";
    externalRef?: string;
    productId?: string | null;
    payload?: Record<string, unknown>;
    createdAt?: Date;
  }
) {
  const [item] = await db
    .insert(schema.queueItems)
    .values({
      batchId: overrides.batchId,
      externalRef: overrides.externalRef ?? `SKU-${crypto.randomUUID()}`,
      source: overrides.source ?? "mercado_livre",
      priority: overrides.priority ?? 0,
      status: overrides.status ?? "pending",
      productId: overrides.productId ?? null,
      payload: overrides.payload ?? { nome: "Produto de teste" },
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning();
  return item!;
}

export async function createProduct(
  db: Db,
  overrides?: Partial<{
    name: string;
    description: string;
    attributes: Record<string, unknown>;
    assemblyItems: string[];
    isActive: boolean;
  }>
) {
  const [product] = await db
    .insert(schema.products)
    .values({
      name: overrides?.name ?? "Produto de Teste",
      description: overrides?.description,
      attributes: overrides?.attributes ?? {},
      assemblyItems: overrides?.assemblyItems ?? [],
      isActive: overrides?.isActive ?? true,
    })
    .returning();
  return product!;
}

export async function createProductSku(
  db: Db,
  overrides: { productId: string; source: "mercado_livre" | "shopee" | "ebay"; sku: string }
) {
  const [row] = await db.insert(schema.productSkus).values(overrides).returning();
  return row!;
}

export async function createProductImage(
  db: Db,
  overrides: { productId: string; storageKey?: string; url?: string; position?: number }
) {
  const [row] = await db
    .insert(schema.productImages)
    .values({
      productId: overrides.productId,
      storageKey: overrides.storageKey ?? `products/${overrides.productId}/${crypto.randomUUID()}.png`,
      url: overrides.url ?? `memory://products/${overrides.productId}/img.png`,
      position: overrides.position ?? 0,
    })
    .returning();
  return row!;
}

export async function createManyQueueItems(
  db: Db,
  opts: { batchId: string; count: number; source?: "mercado_livre" | "shopee" | "ebay" }
) {
  const items = [];
  for (let i = 0; i < opts.count; i++) {
    items.push(await createQueueItem(db, { batchId: opts.batchId, source: opts.source }));
  }
  return items;
}

// queue_priority_rules não é truncada entre testes (Seção "truncateAll" em
// testcontainer.ts) — usar esta factory para fixar/restaurar um estado
// conhecido nos testes que dependem dela.
export async function setPriorityRules(
  db: Db,
  rules: Array<{ source: "mercado_livre" | "shopee" | "ebay"; priority: number; isActive?: boolean }>
) {
  for (const rule of rules) {
    await db
      .update(schema.queuePriorityRules)
      .set({ priority: rule.priority, isActive: rule.isActive ?? true, updatedAt: new Date() })
      .where(eq(schema.queuePriorityRules.source, rule.source));
  }
}

export const DEFAULT_PRIORITY_RULES = [
  { source: "mercado_livre" as const, priority: 2 },
  { source: "shopee" as const, priority: 1 },
  { source: "ebay" as const, priority: 0 },
];

export async function createWorkLog(
  db: Db,
  overrides: {
    queueItemId: string;
    operatorId: string;
    startedAt?: Date;
    completedAt?: Date | null;
    outcome?: "completed" | "abandoned" | "problem" | "cancelled";
  }
) {
  const [log] = await db
    .insert(schema.workLogs)
    .values({
      queueItemId: overrides.queueItemId,
      operatorId: overrides.operatorId,
      startedAt: overrides.startedAt ?? new Date(),
      completedAt: overrides.completedAt ?? null,
      outcome: overrides.outcome,
    })
    .returning();
  return log!;
}

// Cria um work_log já concluído, com duração controlada — base para os
// testes de agregação de analytics (Fase 6).
export async function createCompletedWorkLog(
  db: Db,
  overrides: { queueItemId: string; operatorId: string; startedAt: Date; durationSeconds: number }
) {
  const completedAt = new Date(overrides.startedAt.getTime() + overrides.durationSeconds * 1000);
  const [log] = await db
    .insert(schema.workLogs)
    .values({
      queueItemId: overrides.queueItemId,
      operatorId: overrides.operatorId,
      startedAt: overrides.startedAt,
      completedAt,
      durationSeconds: overrides.durationSeconds,
      outcome: "completed",
    })
    .returning();
  return log!;
}
