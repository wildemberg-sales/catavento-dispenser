import type { FastifyInstance } from "fastify";
import { loginInputSchema, refreshInputSchema, logoutInputSchema } from "@catavento/contracts/auth";
import { usersRepository } from "../users/users.repository.js";
import { authRepository } from "./auth.repository.js";
import { authService } from "./auth.service.js";
import { monitorBus } from "../../lib/monitor-bus.js";
import { onlineOperatorsStore } from "../monitor/online-operators.store.js";
import { queueRepository } from "../queue/queue.repository.js";

export default async function authRoutes(app: FastifyInstance) {
  const service = authService({
    app,
    usersRepo: usersRepository(app.db),
    authRepo: authRepository(app.db),
    bus: monitorBus,
    onlineStore: onlineOperatorsStore,
    queueRepo: queueRepository(app.db),
  });

  // Sem isso, login e refresh não tinham nenhum controle de tentativas —
  // força bruta e credential stuffing eram possíveis sem fricção (limite
  // configurado em plugins/rate-limit.ts, registrado com global:false).
  const rateLimited = { config: { rateLimit: {} } };

  app.post("/login", rateLimited, async (req, reply) => {
    const input = loginInputSchema.parse(req.body);
    const result = await service.login(input.username, input.password);
    return reply.status(200).send(result);
  });

  app.post("/refresh", rateLimited, async (req, reply) => {
    const input = refreshInputSchema.parse(req.body);
    const result = await service.refresh(input.refreshToken);
    return reply.status(200).send(result);
  });

  app.post("/logout", async (req, reply) => {
    const input = logoutInputSchema.parse(req.body);
    await service.logout(input.refreshToken);
    return reply.status(204).send();
  });
}
