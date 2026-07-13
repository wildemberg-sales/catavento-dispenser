import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthUser, TokenPair } from "@catavento/contracts/auth";
import type { UsersRepository } from "../users/users.repository.js";
import type { AuthRepository } from "./auth.repository.js";
import { verifyPassword } from "./password.js";
import { AccountDisabledError, InvalidCredentialsError, InvalidRefreshTokenError } from "../../lib/errors.js";

type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "operator";
  displayName: string;
  isActive: boolean;
};

// `app.jwt.refresh` é decorado em runtime pelo segundo registro de
// @fastify/jwt com `namespace: "refresh"` (src/plugins/jwt.ts), mas os tipos
// publicados do pacote não descrevem essa propriedade dinâmica.
type JwtInstance = FastifyInstance["jwt"];
function refreshJwt(app: FastifyInstance): JwtInstance {
  return (app.jwt as unknown as { refresh: JwtInstance }).refresh;
}

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };
}

export function authService(deps: {
  app: FastifyInstance;
  usersRepo: UsersRepository;
  authRepo: AuthRepository;
}) {
  const { app, usersRepo, authRepo } = deps;

  async function issueTokenPair(user: UserRow): Promise<TokenPair> {
    const accessToken = app.jwt.sign({ sub: user.id, role: user.role, username: user.username });

    const jti = randomUUID();
    const refreshToken = refreshJwt(app).sign({ sub: user.id, jti });
    const decoded = refreshJwt(app).decode<{ exp: number }>(refreshToken);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await authRepo.storeRefreshToken({ userId: user.id, token: refreshToken, expiresAt });

    return { accessToken, refreshToken, user: toAuthUser(user) };
  }

  return {
    async login(username: string, password: string): Promise<TokenPair> {
      const user = await usersRepo.findByUsername(username);
      if (!user) {
        throw new InvalidCredentialsError();
      }

      const validPassword = await verifyPassword(user.passwordHash, password);
      if (!validPassword) {
        throw new InvalidCredentialsError();
      }

      if (!user.isActive) {
        throw new AccountDisabledError();
      }

      return issueTokenPair(user);
    },

    async refresh(refreshToken: string): Promise<TokenPair> {
      try {
        refreshJwt(app).verify(refreshToken);
      } catch {
        throw new InvalidRefreshTokenError();
      }

      const stored = await authRepo.findActiveRefreshToken(refreshToken);
      if (!stored || stored.expiresAt.getTime() <= Date.now()) {
        throw new InvalidRefreshTokenError();
      }

      const user = await usersRepo.findById(stored.userId);
      if (!user || !user.isActive) {
        throw new InvalidRefreshTokenError();
      }

      await authRepo.revokeRefreshToken(refreshToken);
      return issueTokenPair(user);
    },

    async logout(refreshToken: string): Promise<void> {
      await authRepo.revokeRefreshToken(refreshToken);
    },
  };
}

export type AuthService = ReturnType<typeof authService>;
