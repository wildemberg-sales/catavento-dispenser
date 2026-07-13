import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@catavento/contracts/users";

export function requireAuth(app: FastifyInstance) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      const payload = await req.jwtVerify<{ sub: string; role: Role; username: string }>();
      req.authUser = { id: payload.sub, role: payload.role, username: payload.username };
    } catch {
      throw app.httpErrors.unauthorized("Token inválido ou expirado.");
    }
  };
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      throw req.server.httpErrors.forbidden("Acesso negado para este papel.");
    }
  };
}
