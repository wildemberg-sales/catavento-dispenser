import type { FastifyInstance } from "fastify";
import { createProductInputSchema, listProductsQuerySchema, updateProductInputSchema } from "@catavento/contracts/products";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { productsRepository } from "./products.repository.js";
import { productsService } from "./products.service.js";
import imagesRoutes from "./images.routes.js";

export default async function productsRoutes(app: FastifyInstance) {
  const service = productsService({ repo: productsRepository(app.db) });

  app.post(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = createProductInputSchema.parse(req.body);
      const product = await service.createProduct(input, req.authUser!.id);
      return reply.status(201).send(product);
    }
  );

  app.get(
    "/",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const query = listProductsQuerySchema.parse(req.query);
      const result = await service.listProducts(query);
      return reply.status(200).send(result);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const product = await service.getProduct(req.params.id);
      return reply.status(200).send(product);
    }
  );

  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const input = updateProductInputSchema.parse(req.body);
      const product = await service.updateProduct(req.params.id, input);
      return reply.status(200).send(product);
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      await service.deleteProduct(req.params.id);
      return reply.status(200).send({ ok: true });
    }
  );

  await app.register(imagesRoutes);
}
