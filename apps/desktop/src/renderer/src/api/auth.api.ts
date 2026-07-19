import type { TokenPair } from "@catavento/contracts/auth";
import type { ApiClient } from "./client";

export function createAuthApi(client: ApiClient) {
  return {
    login(username: string, password: string): Promise<TokenPair> {
      return client.request<TokenPair>("/auth/login", {
        method: "POST",
        body: { username, password },
        auth: false,
      });
    },

    refresh(refreshToken: string): Promise<TokenPair> {
      return client.request<TokenPair>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      });
    },

    logout(refreshToken: string): Promise<void> {
      return client.request<void>("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      });
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
