import type { FastifyInstance } from "fastify";
import { adminQueueQuerySchema, updatePriorityRulesInputSchema } from "@catavento/contracts/queue";
import { linkQueueItemInputSchema } from "@catavento/contracts/products";
import { paginationQuerySchema } from "@catavento/contracts/common";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { queueRepository } from "./queue.repository.js";
import { queueService } from "./queue.service.js";
import { withMonitorEvents } from "../monitor/instrumented-queue-service.js";
import { monitorBus } from "../../lib/monitor-bus.js";
import { priorityRulesRepository } from "./priority-rules.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { ProductNotFoundError, QueueItemNotFoundError } from "../../lib/errors.js";

export default async function adminQueueRoutes(app: FastifyInstance) {
  const repo = queueRepository(app.db);
  const service = withMonitorEvents(queueService({ repo }), monitorBus, repo);
  const priorityRulesRepo = priorityRulesRepository(app.db);
  const productsRepo = productsRepository(app.db);

  app.get("/", { preHandler: [requireAuth(app), requireRole("admin")] }, async (req, reply) => {
    const query = adminQueueQuerySchema.parse(req.query);
    const { status, batchId, ...pagination } = query;
    const result = await service.listForAdmin({ status, batchId }, pagination);
    return reply.status(200).send(result);
  });

  app.post<{ Params: { id: string } }>(
    "/items/:id/requeue",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      await service.requeueItem(req.params.id);
      return reply.status(200).send({ ok: true });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/items/:id/cancel",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      await service.cancelItem(req.params.id);
      return reply.status(200).send({ ok: true });
    }
  );

  app.put(
    "/rules",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = updatePriorityRulesInputSchema.parse(req.body);
      const rules = await priorityRulesRepo.replaceAll(input.rules);
      return reply.status(200).send({ rules });
    }
  );

  app.get(
    "/unlinked",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const pagination = paginationQuerySchema.parse(req.query);
      const { items, total } = await repo.findAllUnlinkedWithSuggestions(pagination);
      return reply.status(200).send({
        items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/items/:id/link",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = linkQueueItemInputSchema.parse(req.body);

      const item = await repo.findById(req.params.id);
      if (!item) throw new QueueItemNotFoundError();

      const product = await productsRepo.findById(input.productId);
      if (!product || !product.isActive) throw new ProductNotFoundError();

      await repo.setProductId(req.params.id, input.productId);
      return reply.status(200).send({ ok: true });
    }
  );
}
