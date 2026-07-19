import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../App";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra a tela de login quando não há sessão restaurável", async () => {
    window.catavento = {
      secureStore: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    vi.stubGlobal("fetch", vi.fn());

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("login-submit")).toBeTruthy());
  });

  it("mostra o AppShell com a rota de importações quando a sessão é restaurada", async () => {
    window.catavento = {
      secureStore: {
        get: vi.fn().mockResolvedValue("refresh-salvo"),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/admin/imports/")) {
          return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
        }
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: "access-1",
            refreshToken: "refresh-2",
            user: { id: "1", username: "admin1", role: "admin", displayName: "Admin 1" },
          })
        );
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Nenhuma importação ainda.")).toBeTruthy());
    expect(screen.getAllByText("Importações").length).toBeGreaterThan(0);
    expect(screen.getByText("Fila")).toBeTruthy();
  });
});
