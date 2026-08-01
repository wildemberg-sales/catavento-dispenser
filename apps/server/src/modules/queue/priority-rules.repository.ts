import { eq } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import type { PriorityRule, SourceType } from "@catavento/contracts/queue";

export function priorityRulesRepository(db: DbInstance) {
  return {
    async findAsMap(): Promise<Map<SourceType, number>> {
      const rows = await db.select().from(schema.queuePriorityRules);
      return new Map(rows.map((row) => [row.source, row.priority]));
    },

    // Antes só existia `replaceAll` (PUT) — o editor de regras no desktop não
    // tinha como mostrar os valores atuais antes de sobrescrever, só
    // confirmar o que acabou de salvar.
    async findAll(): Promise<PriorityRule[]> {
      const rows = await db.select().from(schema.queuePriorityRules);
      return rows.map((row) => ({ source: row.source, priority: row.priority, isActive: row.isActive }));
    },

    async replaceAll(rules: PriorityRule[]): Promise<PriorityRule[]> {
      await db.transaction(async (tx) => {
        for (const rule of rules) {
          await tx
            .update(schema.queuePriorityRules)
            .set({ priority: rule.priority, isActive: rule.isActive, updatedAt: new Date() })
            .where(eq(schema.queuePriorityRules.source, rule.source));
        }
      });
      const rows = await db.select().from(schema.queuePriorityRules);
      return rows.map((row) => ({ source: row.source, priority: row.priority, isActive: row.isActive }));
    },
  };
}

export type PriorityRulesRepository = ReturnType<typeof priorityRulesRepository>;
