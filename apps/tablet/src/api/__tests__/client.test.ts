import { createApiClient, ApiClientError } from "../client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("createApiClient", () => {
  it("usa o fetch global quando fetchImpl não é informado", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    try {
      const client = createApiClient({
        baseUrl: "http://10.0.2.2:3000",
        getAccessToken: () => null,
        getRefreshToken: () => null,
        onTokensRefreshed: jest.fn(),
        onAuthExpired: jest.fn(),
      });

      const result = await client.request<{ ok: boolean }>("/queue/current", { auth: false });

      expect(result).toEqual({ ok: true });
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("faz uma requisição GET simples e retorna o JSON parseado", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-token",
      getRefreshToken: () => "refresh-token",
      onTokensRefreshed: jest.fn(),
      onAuthExpired: jest.fn(),
    });

    const result = await client.request<{ ok: boolean }>("/queue/current", { auth: true });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/queue/current",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      })
    );
  });

  it("não injeta Authorization quando auth:false (ex.: login)", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { accessToken: "x" }));
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => null,
      getRefreshToken: () => null,
      onTokensRefreshed: jest.fn(),
      onAuthExpired: jest.fn(),
    });

    await client.request("/auth/login", { method: "POST", body: { username: "a", password: "b" }, auth: false });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ username: "a", password: "b" });
  });

  it("em 401, tenta refresh uma vez, atualiza tokens e repete a requisição original", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "novo-access",
          refreshToken: "novo-refresh",
          user: { id: "1", username: "op1", role: "operator", displayName: "Op" },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { available: false }));

    const onTokensRefreshed = jest.fn();
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-valido",
      onTokensRefreshed,
      onAuthExpired: jest.fn(),
    });

    const result = await client.request("/queue/current", { auth: true });

    expect(result).toEqual({ available: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onTokensRefreshed).toHaveBeenCalledWith({ accessToken: "novo-access", refreshToken: "novo-refresh" });
  });

  it("se o refresh também falhar, chama onAuthExpired e rejeita", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "invalido" }));

    const onAuthExpired = jest.fn();
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-invalido",
      onTokensRefreshed: jest.fn(),
      onAuthExpired,
    });

    await expect(client.request("/queue/current", { auth: true })).rejects.toBeInstanceOf(ApiClientError);
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propaga o erro de domínio do backend com code e message", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(403, { error: "FORBIDDEN", message: "Acesso negado" }));
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: jest.fn(),
      onAuthExpired: jest.fn(),
    });

    await expect(client.request("/admin/queue", { auth: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Acesso negado",
    });
  });

  it("erro de domínio sem detalhes no corpo usa mensagem e código padrão", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, {}));
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: jest.fn(),
      onAuthExpired: jest.fn(),
    });

    await expect(client.request("/admin/queue", { auth: true })).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "Erro na requisição.",
    });
  });

  it("falha de refresh sem detalhes no corpo usa mensagem e código padrão", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(500, {}));

    const onAuthExpired = jest.fn();
    const client = createApiClient({
      baseUrl: "http://10.0.2.2:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-invalido",
      onTokensRefreshed: jest.fn(),
      onAuthExpired,
    });

    await expect(client.request("/queue/current", { auth: true })).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      message: "Sessão expirada.",
    });
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });
});
