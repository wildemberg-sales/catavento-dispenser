import type { FastifyInstance } from "fastify";
import { analyticsPeriodQuerySchema, exportQuerySchema, throughputQuerySchema } from "@catavento/contracts/analytics";
import { paginationQuerySchema } from "@catavento/contracts/common";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { analyticsRepository } from "./analytics.repository.js";
import { analyticsService } from "./analytics.service.js";
import { usersRepository } from "../users/users.repository.js";
import { exportService } from "./export.service.js";
import { MissingOperatorIdError } from "../../lib/errors.js";

export default async function analyticsRoutes(app: FastifyInstance) {
  const service = analyticsService({
    repo: analyticsRepository(app.db),
    usersRepo: usersRepository(app.db),
    maxRangeDays: app.config.ANALYTICS_MAX_RANGE_DAYS,
  });
  const exporter = exportService({ service });

  app.get(
    "/analytics/by-operator",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const { from, to } = analyticsPeriodQuerySchema.parse(req.query);
      const pagination = paginationQuerySchema.parse(req.query);
      const result = await service.getByOperator(from, to, pagination);
      return reply.status(200).send(result);
    }
  );

  app.get(
    "/analytics/by-product",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const { from, to } = analyticsPeriodQuerySchema.parse(req.query);
      const pagination = paginationQuerySchema.parse(req.query);
      const result = await service.getByProduct(from, to, pagination);
      return reply.status(200).send(result);
    }
  );

  app.get(
    "/analytics/throughput",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = throughputQuerySchema.parse(req.query);
      const result = await service.getThroughput(query.from, query.to, query.bucket);
      return reply.status(200).send({ items: result });
    }
  );

  app.get<{ Params: { id: string } }>(
    "/reports/operator/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const { from, to } = analyticsPeriodQuerySchema.parse(req.query);
      const result = await service.getOperatorReport(req.params.id, from, to);
      return reply.status(200).send(result);
    }
  );

  app.get(
    "/analytics/export",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = exportQuerySchema.parse(req.query);
      if (query.report === "operator-report" && !query.operatorId) {
        throw new MissingOperatorIdError();
      }

      const { buffer, contentType, filename } = await exporter.export(query);
      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.status(200).send(buffer);
    }
  );
}
