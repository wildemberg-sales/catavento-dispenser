import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    attributes: jsonb("attributes").notNull().default({}),
    // Lista de itens/passos para a montagem física do produto (ex.: bolo fake
    // de aniversário) — texto livre por item, exibido ao operador junto das
    // imagens de referência (Seção 4.2 do spec já previa isso dentro de
    // "attributes"; aqui vira campo tipado próprio, como images/skus).
    assemblyItems: jsonb("assembly_items").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Fuzzy matching para reconciliação manual (Fase 5) via extensão pg_trgm
    // (CREATE EXTENSION adicionado manualmente na migration gerada, já que o
    // drizzle-kit não gera isso a partir do schema TS).
    index("products_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
  ]
);
