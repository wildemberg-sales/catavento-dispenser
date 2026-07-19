import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiClientError } from "../client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => {
      throw new Error("204 não tem corpo pra parsear como JSON");
    },
  } as Response;
}

describe("createApiClient", () => {
  it("usa o fetch global quando fetchImpl não é informado", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    try {
      const client = createApiClient({
        baseUrl: "http://localhost:3000",
        getAccessToken: () => null,
        getRefreshToken: () => null,
        onTokensRefreshed: vi.fn(),
        onAuthExpired: vi.fn(),
      });

      const result = await client.request<{ ok: boolean }>("/queue/current", { auth: false });

      expect(result).toEqual({ ok: true });
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("não injeta Authorization quando auth != false mas ainda não há access token (ex.: antes do login)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => null,
      getRefreshToken: () => null,
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await client.request("/admin/queue/");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("faz uma requisição GET simples e retorna o JSON parseado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-token",
      getRefreshToken: () => "refresh-token",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    const result = await client.request<{ ok: boolean }>("/queue/current", { auth: true });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/queue/current",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      })
    );
  });

  it("não injeta Authorization quando auth:false (ex.: login)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { accessToken: "x" }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => null,
      getRefreshToken: () => null,
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await client.request("/auth/login", { method: "POST", body: { username: "a", password: "b" }, auth: false });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ username: "a", password: "b" });
  });

  it("em 401, tenta refresh uma vez, atualiza tokens e repete a requisição original", async () => {
    const fetchMock = vi
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

    const onTokensRefreshed = vi.fn();
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-valido",
      onTokensRefreshed,
      onAuthExpired: vi.fn(),
    });

    const result = await client.request("/queue/current", { auth: true });

    expect(result).toEqual({ available: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onTokensRefreshed).toHaveBeenCalledWith({ accessToken: "novo-access", refreshToken: "novo-refresh" });
  });

  it("se o refresh também falhar, chama onAuthExpired e rejeita", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "INVALID_REFRESH_TOKEN", message: "invalido" }));

    const onAuthExpired = vi.fn();
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-invalido",
      onTokensRefreshed: vi.fn(),
      onAuthExpired,
    });

    await expect(client.request("/queue/current", { auth: true })).rejects.toBeInstanceOf(ApiClientError);
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propaga o erro de domínio do backend com code e message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { error: "FORBIDDEN", message: "Acesso negado" }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await expect(client.request("/admin/queue", { auth: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Acesso negado",
    });
  });

  it("erro de domínio sem detalhes no corpo usa mensagem e código padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await expect(client.request("/admin/queue", { auth: true })).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "Erro na requisição.",
    });
  });

  it("falha de refresh sem detalhes no corpo usa mensagem e código padrão", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(jsonResponse(500, {}));

    const onAuthExpired = vi.fn();
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-invalido",
      onTokensRefreshed: vi.fn(),
      onAuthExpired,
    });

    await expect(client.request("/queue/current", { auth: true })).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      message: "Sessão expirada.",
    });
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it("envia FormData como corpo sem serializar em JSON e sem forçar Content-Type (deixa o browser definir o boundary multipart)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: "batch-1" }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });
    const formData = new FormData();
    formData.append("file", new Blob(["a,b\n1,2"], { type: "text/csv" }), "pedidos.csv");

    await client.request("/admin/imports/", { method: "POST", body: formData, auth: true });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toBe(formData);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer token");
  });

  it("resolve sem erro numa resposta 204 sem corpo (ex.: logout, reset de senha)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse(204));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await expect(client.request<void>("/auth/logout", { method: "POST", body: { refreshToken: "x" } })).resolves.toBeUndefined();
  });

  it("requestBlob retorna o corpo binário numa resposta de sucesso", async () => {
    const blob = new Blob(["conteudo-do-csv"], { type: "text/csv" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => blob } as unknown as Response);
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    const result = await client.requestBlob("/admin/analytics/export?format=csv");

    expect(result).toBe(blob);
  });

  it("requestBlob tenta refresh em 401 e repete a requisição original", async () => {
    const blob = new Blob(["dados"], { type: "text/csv" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "UNAUTHORIZED", message: "expirado" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: "novo-access",
          refreshToken: "novo-refresh",
          user: { id: "1", username: "admin1", role: "admin", displayName: "Admin" },
        })
      )
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob } as unknown as Response);

    const onTokensRefreshed = vi.fn();
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "access-expirado",
      getRefreshToken: () => "refresh-valido",
      onTokensRefreshed,
      onAuthExpired: vi.fn(),
    });

    const result = await client.requestBlob("/admin/analytics/export");

    expect(result).toBe(blob);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onTokensRefreshed).toHaveBeenCalledWith({ accessToken: "novo-access", refreshToken: "novo-refresh" });
  });

  it("requestBlob propaga erro de domínio numa resposta de falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { error: "RANGE_TOO_LARGE", message: "período muito longo" }));
    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchMock,
      getAccessToken: () => "token",
      getRefreshToken: () => "refresh",
      onTokensRefreshed: vi.fn(),
      onAuthExpired: vi.fn(),
    });

    await expect(client.requestBlob("/admin/analytics/export")).rejects.toMatchObject({
      code: "RANGE_TOO_LARGE",
      message: "período muito longo",
    });
  });
});
