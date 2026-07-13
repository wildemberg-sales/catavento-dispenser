import type { CreateUserInput, ListUsersQuery, ResetPasswordInput, UpdateUserInput } from "@catavento/contracts/users";
import type { UsersRepository } from "./users.repository.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { hashPassword } from "../auth/password.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { CannotDeactivateSelfError, UserNotFoundError, UsernameTakenError } from "../../lib/errors.js";

export function usersService(deps: { repo: UsersRepository; authRepo: AuthRepository }) {
  const { repo, authRepo } = deps;

  return {
    async createUser(input: CreateUserInput) {
      const existing = await repo.findByUsername(input.username);
      if (existing) throw new UsernameTakenError();

      const passwordHash = await hashPassword(input.password);
      try {
        return await repo.insert({
          username: input.username,
          passwordHash,
          role: input.role,
          displayName: input.displayName,
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw new UsernameTakenError();
        throw err;
      }
    },

    async listUsers(query: ListUsersQuery) {
      const { role, isActive, page, pageSize } = query;
      const { items, total } = await repo.list({ role, isActive }, { page, pageSize });
      return { items, total, page, pageSize };
    },

    async updateUser(id: string, input: UpdateUserInput, requestingUserId: string) {
      const existing = await repo.findById(id);
      if (!existing) throw new UserNotFoundError();

      if (input.isActive === false && requestingUserId === id) {
        throw new CannotDeactivateSelfError();
      }

      const updated = await repo.update(id, input);

      if (existing.isActive && input.isActive === false) {
        await authRepo.revokeAllForUser(id);
      }

      return updated;
    },

    async resetPassword(id: string, input: ResetPasswordInput) {
      const existing = await repo.findById(id);
      if (!existing) throw new UserNotFoundError();
      const passwordHash = await hashPassword(input.newPassword);
      await repo.updatePassword(id, passwordHash);
    },
  };
}

export type UsersService = ReturnType<typeof usersService>;
