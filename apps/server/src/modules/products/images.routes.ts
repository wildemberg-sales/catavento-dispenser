import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/rbac.js";
import { productsRepository } from "./products.repository.js";
import { ImageNotFoundError, InvalidImageTypeError, NoFileUploadedError, ProductNotFoundError, TooManyImagesError } from "../../lib/errors.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default async function imagesRoutes(app: FastifyInstance) {
  const repo = productsRepository(app.db);

  app.post<{ Params: { id: string } }>(
    "/:id/images",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const product = await repo.findById(req.params.id);
      if (!product) throw new ProductNotFoundError();

      const data = await req.file();
      if (!data) throw new NoFileUploadedError();
      if (!ALLOWED_MIME_TYPES.has(data.mimetype)) throw new InvalidImageTypeError();

      const currentCount = await repo.countImages(product.id);
      if (currentCount >= app.config.MAX_IMAGES_PER_PRODUCT) throw new TooManyImagesError();

      const buffer = await data.toBuffer();
      const key = `products/${product.id}/${randomUUID()}-${sanitizeFilename(data.filename)}`;
      const meta = await app.storage.upload({ key, body: buffer, contentType: data.mimetype });

      const image = await repo.insertImage({
        productId: product.id,
        storageKey: meta.key,
        url: meta.url,
        position: currentCount,
      });

      return reply.status(201).send({ id: image.id, url: image.url, position: image.position });
    }
  );

  app.delete<{ Params: { id: string; imageId: string } }>(
    "/:id/images/:imageId",
    { preHandler: [requireAuth(app), requireRole("admin")] },
    async (req, reply) => {
      const image = await repo.findImageById(req.params.imageId);
      if (!image || image.productId !== req.params.id) throw new ImageNotFoundError();

      await app.storage.delete(image.storageKey);
      await repo.deleteImage(image.id);

      return reply.status(200).send({ ok: true });
    }
  );
}
