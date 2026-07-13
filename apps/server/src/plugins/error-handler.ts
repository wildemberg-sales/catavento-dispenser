import fp from "fastify-plugin";
import type { FastifyError } from "fastify";
import { ZodError } from "zod";
import { DomainError } from "../lib/errors.js";

export default fp(async (app) => {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Dados de entrada inválidos.",
        details: error.issues,
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(statusCode).send({
        error: "INTERNAL_ERROR",
        message: "Erro interno do servidor.",
      });
    }

    const knownCodes: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
    };
    return reply.status(statusCode).send({
      error: knownCodes[statusCode] ?? "HTTP_ERROR",
      message: error.message,
    });
  });
});
