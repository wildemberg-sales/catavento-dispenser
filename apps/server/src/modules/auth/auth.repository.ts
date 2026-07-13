import { and, eq, isNull } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import { sha256Hex } from "../../lib/hash.js";

export function authRepository(db: DbInstance) {
  return {
    async storeRefreshToken(params: { userId: string; token: string; expiresAt: Date }) {
      await db.insert(schema.refreshTokens).values({
        userId: params.userId,
        tokenHash: sha256Hex(params.token),
        expiresAt: params.expiresAt,
      });
    },

    async findActiveRefreshToken(token: string) {
      const tokenHash = sha256Hex(token);
      const [row] = await db
        .select()
        .from(schema.refreshTokens)
        .where(and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)));
      return row ?? null;
    },

    async revokeRefreshToken(token: string) {
      const tokenHash = sha256Hex(token);
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)));
    },

    async revokeAllForUser(userId: string) {
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)));
    },
  };
}

export type AuthRepository = ReturnType<typeof authRepository>;
