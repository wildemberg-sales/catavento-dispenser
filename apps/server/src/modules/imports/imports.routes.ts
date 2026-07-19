import type { FastifyInstance } from "fastify";
import { confirmImportInputSchema, listImportRowsQuerySchema } from "@catavento/contracts/imports";
import { paginationQuerySchema } from "@catavento/contracts/common";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { NoFileUploadedError } from "../../lib/errors.js";
import { importsRepository } from "./imports.repository.js";
import { importsService } from "./imports.service.js";
import { priorityRulesRepository } from "../queue/priority-rules.repository.js";
import { queueRepository } from "../queue/queue.repository.js";
import { monitorBus } from "../../lib/monitor-bus.js";

export default async function importsRoutes(app: FastifyInstance) {
  const service = importsService({
    repo: importsRepository(app.db),
    priorityRulesRepo: priorityRulesRepository(app.db),
    queueRepo: queueRepository(app.db),
    bus: monitorBus,
  });

  app.post(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const data = await req.file();
      if (!data) throw new NoFileUploadedError();
      const buffer = await data.toBuffer();
      const result = await service.createPreview(buffer, data.filename, req.authUser!.id);
      return reply.status(201).send(result);
    }
  );

  app.get(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = paginationQuerySchema.parse(req.query);
      const result = await service.listBatches(query);
      return reply.status(200).send(result);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const result = await service.getBatch(req.params.id);
      return reply.status(200).send(result);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/:id/rows",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = listImportRowsQuerySchema.parse(req.query);
      const { status, ...pagination } = query;
      const result = await service.listRows(req.params.id, { status }, pagination);
      return reply.status(200).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/confirm",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = confirmImportInputSchema.parse(req.body);
      const result = await service.confirmImport(req.params.id, input.columnMapping);
      return reply.status(200).send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/link",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const result = await service.linkBatch(req.params.id);
      return reply.status(200).send(result);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/:id/unlinked",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const pagination = paginationQuerySchema.parse(req.query);
      const result = await service.getUnlinked(req.params.id, pagination);
      return reply.status(200).send(result);
    }
  );
}
