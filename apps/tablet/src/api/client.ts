export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// Distingue uma rejeição definitiva do servidor (ex.: item cancelado por um
// admin enquanto o operador estava com ele em mãos — NotYourItemError, 403;
// item já concluído — AlreadyCompletedError, 409) de uma falha de rede de
// verdade. Reenviar uma rejeição permanente nunca muda o resultado — antes
// disso existir, o app tratava os dois casos como "sem conexão" e
// reenfileirava pra tentar de novo pra sempre, sem nunca avisar ninguém.
// 401 fica de fora de propósito: é tratado à parte pelo fluxo de refresh de
// token do próprio client, não é uma rejeição ligada ao estado do item.
export function isPermanentRejection(error: unknown): boolean {
  return error instanceof ApiClientError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 401;
}

type Tokens = { accessToken: string; refreshToken: string };

export type ApiClientConfig = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (tokens: Tokens) => void;
  onAuthExpired: () => void;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export function createApiClient(config: ApiClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  let refreshInFlight: Promise<Tokens> | null = null;

  async function doFetch(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false) {
      const accessToken = config.getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return fetchImpl(`${config.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  async function refreshTokens(): Promise<Tokens> {
    const refreshToken = config.getRefreshToken();
    const response = await fetchImpl(`${config.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiClientError(data.message ?? "Falha ao renovar sessão.", data.error ?? "REFRESH_FAILED", response.status);
    }
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      let response = await doFetch(path, options);

      if (response.status === 401 && options.auth !== false) {
        try {
          refreshInFlight ??= refreshTokens();
          const tokens = await refreshInFlight;
          refreshInFlight = null;
          config.onTokensRefreshed(tokens);
          response = await doFetch(path, options);
        } catch {
          refreshInFlight = null;
          config.onAuthExpired();
          throw new ApiClientError("Sessão expirada.", "SESSION_EXPIRED", 401);
        }
      }

      // 204 (ex.: heartbeat, logout) nunca tem corpo — chamar .json()
      // incondicionalmente lançaria um erro de parse numa resposta de
      // sucesso. O heartbeat (POST /queue/heartbeat, chamado a cada 60s
      // enquanto logado) sempre bateu nisso silenciosamente: o erro de
      // parse era engolido pelo mesmo catch genérico que trata falha de
      // rede, então nunca apareceu como um bug visível.
      const data = response.status === 204 ? undefined : await response.json();
      if (!response.ok) {
        throw new ApiClientError(data?.message ?? "Erro na requisição.", data?.error ?? "UNKNOWN_ERROR", response.status);
      }
      return data as T;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
