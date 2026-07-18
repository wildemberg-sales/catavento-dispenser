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

      const data = await response.json();
      if (!response.ok) {
        throw new ApiClientError(data.message ?? "Erro na requisição.", data.error ?? "UNKNOWN_ERROR", response.status);
      }
      return data as T;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
