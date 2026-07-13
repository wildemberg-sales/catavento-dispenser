import type { FastifyInstance } from "fastify";
import {
  createUserInputSchema,
  listUsersQuerySchema,
  resetPasswordInputSchema,
  updateUserInputSchema,
} from "@catavento/contracts/users";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { usersRepository } from "./users.repository.js";
import { authRepository } from "../auth/auth.repository.js";
import { usersService } from "./users.service.js";
import { toUserDto } from "./users.mapper.js";

export default async function usersRoutes(app: FastifyInstance) {
  const service = usersService({
    repo: usersRepository(app.db),
    authRepo: authRepository(app.db),
  });

  app.post(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = createUserInputSchema.parse(req.body);
      const user = await service.createUser(input);
      return reply.status(201).send(toUserDto(user));
    }
  );

  app.get(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = listUsersQuerySchema.parse(req.query);
      const result = await service.listUsers(query);
      return reply.status(200).send({ ...result, items: result.items.map(toUserDto) });
    }
  );

  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = updateUserInputSchema.parse(req.body);
      const updated = await service.updateUser(req.params.id, input, req.authUser!.id);
      return reply.status(200).send(toUserDto(updated!));
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/reset-password",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = resetPasswordInputSchema.parse(req.body);
      await service.resetPassword(req.params.id, input);
      return reply.status(204).send();
    }
  );
}
