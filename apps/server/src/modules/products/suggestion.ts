import { sql } from "drizzle-orm";
import type { DbInstance } from "@catavento/db";

export async function findSuggestionsForItem(
  db: DbInstance,
  externalRef: string,
  payload: Record<string, unknown>
): Promise<Array<{ productId: string; productName: string; score: number }>> {
  const displayName =
    (payload.nome as string | undefined) ?? (payload.name as string | undefined) ?? externalRef;
  const result = await db.execute(sql`
    SELECT id, name, similarity(name, ${displayName}) AS score
    FROM products
    WHERE is_active = true AND similarity(name, ${displayName}) > 0.2
    ORDER BY score DESC
    LIMIT 3
  `);
  return result.rows.map((row) => ({
    productId: (row as Record<string, unknown>).id as string,
    productName: (row as Record<string, unknown>).name as string,
    score: Number((row as Record<string, unknown>).score),
  }));
}
