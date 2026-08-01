import * as argon2 from "argon2";
import type { DbInstance } from "../client.js";
import { users } from "../schema/index.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

// Overrides existem pra permitir senhas fortes num ambiente que não seja o
// dev local (ex.: uma instância de homologação) sem tocar no código — os
// literais abaixo são só o default de conveniência pro fluxo local.
export async function seed(
  db: DbInstance,
  overrides: { adminPassword?: string; operatorPassword?: string } = {}
) {
  const adminHash = await argon2.hash(overrides.adminPassword ?? "admin123", ARGON2_OPTIONS);
  const operatorHash = await argon2.hash(overrides.operatorPassword ?? "operador123", ARGON2_OPTIONS);

  await db
    .insert(users)
    .values([
      {
        username: "admin",
        passwordHash: adminHash,
        role: "admin",
        displayName: "Administrador",
      },
      {
        username: "operador1",
        passwordHash: operatorHash,
        role: "operator",
        displayName: "Operador 1",
      },
    ])
    .onConflictDoNothing({ target: users.username });
}
