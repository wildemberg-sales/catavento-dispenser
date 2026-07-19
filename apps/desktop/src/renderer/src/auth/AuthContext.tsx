import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "@catavento/contracts/auth";
import { createApiClient, type ApiClient } from "../api/client";
import { createAuthApi } from "../api/auth.api";

const REFRESH_TOKEN_KEY = "catavento.refreshToken";

export class ForbiddenRoleError extends Error {}

type SecureStoreLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiClient: ApiClient;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  baseUrl,
  fetchImpl,
  secureStore = window.catavento.secureStore,
}: {
  children: React.ReactNode;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  secureStore?: SecureStoreLike;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: null,
    refreshToken: null,
  });

  const apiClient = useMemo(() => {
    const config: Parameters<typeof createApiClient>[0] = {
      baseUrl,
      getAccessToken: () => tokensRef.current.accessToken,
      getRefreshToken: () => tokensRef.current.refreshToken,
      onTokensRefreshed: (tokens) => {
        tokensRef.current = tokens;
        void secureStore.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
      },
      onAuthExpired: () => {
        tokensRef.current = { accessToken: null, refreshToken: null };
        setUser(null);
      },
    };
    if (fetchImpl !== undefined) config.fetchImpl = fetchImpl;
    return createApiClient(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const authApi = useMemo(() => createAuthApi(apiClient), [apiClient]);

  useEffect(() => {
    (async () => {
      const storedRefreshToken = await secureStore.get(REFRESH_TOKEN_KEY);
      if (storedRefreshToken) {
        try {
          const result = await authApi.refresh(storedRefreshToken);
          tokensRef.current = { accessToken: result.accessToken, refreshToken: result.refreshToken };
          await secureStore.set(REFRESH_TOKEN_KEY, result.refreshToken);
          setUser(result.user);
        } catch {
          await secureStore.delete(REFRESH_TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authApi]);

  async function login(username: string, password: string) {
    const result = await authApi.login(username, password);
    if (result.user.role !== "admin") {
      // Revoga o refresh token já emitido pelo servidor — a sessão nunca é
      // estabelecida no cliente para um papel que não seja admin.
      await authApi.logout(result.refreshToken).catch(() => {});
      throw new ForbiddenRoleError("Esta aplicação é restrita a administradores.");
    }
    tokensRef.current = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    await secureStore.set(REFRESH_TOKEN_KEY, result.refreshToken);
    setUser(result.user);
  }

  async function logout() {
    const refreshToken = tokensRef.current.refreshToken;
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Rede indisponível no logout não deve travar o usuário na tela —
        // o refresh token só continuaria válido no servidor até expirar.
      }
    }
    tokensRef.current = { accessToken: null, refreshToken: null };
    await secureStore.delete(REFRESH_TOKEN_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout, apiClient }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
}
