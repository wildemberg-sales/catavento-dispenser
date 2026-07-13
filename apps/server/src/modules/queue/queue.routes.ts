import type { FastifyInstance } from "fastify";
import { problemItemInputSchema } from "@catavento/contracts/queue";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { queueRepository } from "./queue.repository.js";
import { queueService } from "./queue.service.js";
import { withMonitorEvents } from "../monitor/instrumented-queue-service.js";
import { monitorBus } from "../../lib/monitor-bus.js";

export default async function queueRoutes(app: FastifyInstance) {
  const repo = queueRepository(app.db);
  const service = withMonitorEvents(queueService({ repo }), monitorBus, repo);

  app.post(
    "/next",
    { preHandler: [requireAuth(app), requireRole("operator")] },
    async (req, reply) => {
      const result = await service.dequeueNext(req.authUser!.id);
      return reply.status(200).send(result);
    }
  );

  app.get(
    "/current",
    { preHandler: [requireAuth(app), requireRole("operator")] },
    async (req, reply) => {
      const result = await service.getCurrentForOperator(req.authUser!.id);
      return reply.status(200).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/items/:id/complete",
    { preHandler: [requireAuth(app), requireRole("operator")] },
    async (req, reply) => {
      await service.completeItem(req.authUser!.id, req.params.id);
      return reply.status(200).send({ ok: true });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/items/:id/problem",
    { preHandler: [requireAuth(app), requireRole("operator")] },
    async (req, reply) => {
      const input = problemItemInputSchema.parse(req.body);
      await service.reportProblem(req.authUser!.id, req.params.id, input.note);
      return reply.status(200).send({ ok: true });
    }
  );
}
