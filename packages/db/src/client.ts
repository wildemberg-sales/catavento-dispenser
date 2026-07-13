import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";

export type DbInstance = NodePgDatabase<typeof schema>;

export function createDbPool(connectionString: string, opts?: { max?: number }) {
  const pool = new Pool({ connectionString, max: opts?.max ?? 10 });
  // node-postgres exige um listener de erro no pool: clientes ociosos podem
  // emitir erros em segundo plano (ex.: conexão derrubada pelo servidor) e,
  // sem esse listener, o processo Node inteiro cai com uma exceção não
  // tratada, mesmo sem nenhuma query em andamento.
  pool.on("error", (err) => {
    console.error("Erro inesperado em cliente ocioso do pool Postgres:", err);
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}
