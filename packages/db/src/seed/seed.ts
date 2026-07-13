import * as argon2 from "argon2";
import type { DbInstance } from "../client.js";
import { users } from "../schema/index.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function seed(db: DbInstance) {
  const adminHash = await argon2.hash("admin123", ARGON2_OPTIONS);
  const operatorHash = await argon2.hash("operador123", ARGON2_OPTIONS);

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
