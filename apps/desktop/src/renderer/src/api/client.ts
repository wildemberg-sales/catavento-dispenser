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
    const isFormData = options.body instanceof FormData;
    // FormData nunca leva Content-Type manual — o browser define o boundary
    // multipart sozinho; setar isso na mão quebra o parse do multipart no
    // servidor.
    if (options.body !== undefined && !isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (options.auth !== false) {
      const accessToken = config.getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    const init: RequestInit = { method: options.method ?? "GET", headers };
    if (options.body !== undefined) {
      init.body = isFormData ? (options.body as FormData) : JSON.stringify(options.body);
    }
    return fetchImpl(`${config.baseUrl}${path}`, init);
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

  async function fetchWithRefresh(path: string, options: RequestOptions): Promise<Response> {
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

    return response;
  }

  return {
    getAccessToken(): string | null {
      return config.getAccessToken();
    },

    getBaseUrl(): string {
      return config.baseUrl;
    },

    getFetchImpl(): typeof fetch {
      return fetchImpl;
    },

    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const response = await fetchWithRefresh(path, options);

      // 204 (ex.: logout, reset de senha) nunca tem corpo — chamar .json()
      // incondicionalmente lançaria um erro de parse numa resposta de sucesso.
      const data = response.status === 204 ? undefined : await response.json();
      if (!response.ok) {
        throw new ApiClientError(data?.message ?? "Erro na requisição.", data?.error ?? "UNKNOWN_ERROR", response.status);
      }
      return data as T;
    },

    async requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
      const response = await fetchWithRefresh(path, options);

      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        throw new ApiClientError(data?.message ?? "Erro na requisição.", data?.error ?? "UNKNOWN_ERROR", response.status);
      }
      return response.blob();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
