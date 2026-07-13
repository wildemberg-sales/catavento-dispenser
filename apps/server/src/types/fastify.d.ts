import type { DbInstance } from "@catavento/db";
import type { Role } from "@catavento/contracts/users";
import type { StoragePort } from "../lib/storage/storage.port.js";
import type { Config } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    db: DbInstance;
    storage: StoragePort;
    config: Config;
  }

  interface FastifyRequest {
    authUser?: {
      id: string;
      username: string;
      role: Role;
    };
    refreshJwtVerify<Decoded extends object | string = { sub: string; jti: string }>(
      options?: Record<string, unknown>
    ): Promise<Decoded>;
  }

  interface FastifyReply {
    refreshJwtSign(payload: object | string, options?: Record<string, unknown>): Promise<string>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    // União porque o mesmo tipo de payload cobre tanto o access token
    // (app.jwt) quanto o refresh token (app.jwt.refresh, ver auth.service.ts).
    payload: { sub: string; role: Role; username: string } | { sub: string; jti: string };
    user: { sub: string; role: Role; username: string } | { sub: string; jti: string };
  }
}
