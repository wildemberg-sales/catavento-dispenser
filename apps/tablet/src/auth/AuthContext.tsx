import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as ExpoSecureStore from "expo-secure-store";
import type { AuthUser } from "@catavento/contracts/auth";
import { createApiClient, type ApiClient } from "../api/client";
import { createAuthApi } from "../api/auth.api";
import { createQueueApi } from "../api/queue.api";

const REFRESH_TOKEN_KEY = "catavento.refreshToken";
// Mantém o operador marcado como online no Monitor do desktop (Tarefa #74)
// enquanto o app estiver logado, e não só entre login/logout — sem isso um
// app que restaura a sessão a partir do refresh token salvo (sem passar por
// login()) nunca chegava a aparecer como online até o primeiro heartbeat, e
// uma queda de rede/crash sem logout explícito deixava o operador "online"
// pra sempre até o sweep no servidor expirar (Seção 6.4, OPERATOR_ONLINE_TIMEOUT_MINUTES).
const HEARTBEAT_INTERVAL_MS = 60_000;

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
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
  secureStore = ExpoSecureStore,
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

  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl,
        fetchImpl,
        getAccessToken: () => tokensRef.current.accessToken,
        getRefreshToken: () => tokensRef.current.refreshToken,
        onTokensRefreshed: (tokens) => {
          tokensRef.current = tokens;
          void secureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
        },
        onAuthExpired: () => {
          tokensRef.current = { accessToken: null, refreshToken: null };
          setUser(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseUrl]
  );

  const authApi = useMemo(() => createAuthApi(apiClient), [apiClient]);
  const queueApi = useMemo(() => createQueueApi(apiClient), [apiClient]);

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = () => {
      queueApi.heartbeat().catch(() => {
        // Falha de rede pontual não deve derrubar o app — o próximo tick
        // (ou o sweep no servidor) resolve sozinho.
      });
    };

    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, queueApi]);

  useEffect(() => {
    (async () => {
      const storedRefreshToken = await secureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (storedRefreshToken) {
        try {
          const result = await authApi.refresh(storedRefreshToken);
          tokensRef.current = { accessToken: result.accessToken, refreshToken: result.refreshToken };
          await secureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
          setUser(result.user);
        } catch {
          await secureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authApi]);

  async function login(username: string, password: string) {
    const result = await authApi.login(username, password);
    tokensRef.current = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    await secureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
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
    await secureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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
