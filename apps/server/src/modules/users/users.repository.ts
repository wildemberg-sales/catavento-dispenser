import { and, count, eq } from "drizzle-orm";
import { schema, type DbInstance } from "@catavento/db";
import type { Role } from "@catavento/contracts/users";

export function usersRepository(db: DbInstance) {
  return {
    async findByUsername(username: string) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
      return user ?? null;
    },
    async findById(id: string) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
      return user ?? null;
    },

    async insert(data: { username: string; passwordHash: string; role: Role; displayName: string }) {
      const [user] = await db.insert(schema.users).values(data).returning();
      return user!;
    },

    async list(
      filters: { role?: Role | undefined; isActive?: boolean | undefined },
      pagination: { page: number; pageSize: number }
    ) {
      const conditions = [];
      if (filters.role) conditions.push(eq(schema.users.role, filters.role));
      if (filters.isActive !== undefined) conditions.push(eq(schema.users.isActive, filters.isActive));
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const offset = (pagination.page - 1) * pagination.pageSize;
      const [items, totalRows] = await Promise.all([
        db.select().from(schema.users).where(where).limit(pagination.pageSize).offset(offset),
        db.select({ total: count() }).from(schema.users).where(where),
      ]);
      return { items, total: Number(totalRows[0]!.total) };
    },

    async update(
      id: string,
      patch: Partial<{ displayName: string | undefined; role: Role | undefined; isActive: boolean | undefined }>
    ) {
      const [user] = await db
        .update(schema.users)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
      return user ?? null;
    },

    async updatePassword(id: string, passwordHash: string) {
      await db.update(schema.users).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.users.id, id));
    },
  };
}

export type UsersRepository = ReturnType<typeof usersRepository>;
