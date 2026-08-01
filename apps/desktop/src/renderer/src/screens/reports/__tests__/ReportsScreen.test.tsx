import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider } from "../../../auth/AuthContext";
import { ReportsScreen } from "../ReportsScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function renderScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <ReportsScreen />
    </AuthProvider>
  );
}

const operatorRow = {
  operatorId: "op-1",
  displayName: "Fulano",
  completedCount: 10,
  abandonedCount: 1,
  problemCount: 2,
  inProgressCount: 0,
  activeSecondsTotal: 3600,
  avgDurationSeconds: 120,
  completionRate: 0.83,
  weightedRelativeSpeedScore: 1.1,
};

const productRow = {
  productId: "prod-1",
  productName: "Bolo Fake Rosa",
  completedCount: 8,
  avgDurationSeconds: 90,
  stddevDurationSeconds: 5,
  distinctOperators: 3,
};

const operatorReport = {
  operator: { id: "op-1", username: "op1", displayName: "Fulano" },
  period: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T23:59:59.999Z" },
  overview: {
    productivity: { itemsPerHour: 4.5, avgDurationSeconds: 120, completedCount: 10 },
    quality: { completionRate: 0.9, problemRate: 0.05, abandonmentRate: 0.05, qualityIndex: 0.88 },
    punctuality: { avgGapSeconds: 30, durationCoefficientOfVariation: 0.2, punctualityIndex: 0.75 },
  },
  byProduct: [
    { productId: "prod-1", productName: "Bolo Fake Rosa", completedCount: 5, avgDurationSeconds: 100, teamAvgDurationSeconds: 110, relativeSpeedIndex: 1.1 },
  ],
  ranking: { weightedRelativeSpeedScore: 1.2, positionAmongOperators: 2, totalOperatorsRanked: 8 },
  timeSeries: [{ date: "2026-01-01", completedCount: 3, avgDurationSeconds: 100, itemsPerHour: 4 }],
};

const reportItem = {
  workLogId: "wl-1",
  queueItemId: "item-1",
  productName: "Bolo Fake Rosa",
  outcome: "problem",
  startedAt: "2026-01-01T10:00:00.000Z",
  completedAt: "2026-01-01T10:05:00.000Z",
  durationSeconds: 300,
  problemNote: "Foto não bate com o pedido",
};

function buildFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/analytics/by-operator")) {
      return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 1, page: 1, pageSize: 20 }));
    }
    if (url.includes("/admin/analytics/by-product")) {
      return Promise.resolve(jsonResponse(200, { items: [productRow], total: 1, page: 1, pageSize: 20 }));
    }
    if (url.includes("/admin/analytics/throughput")) {
      return Promise.resolve(
        jsonResponse(200, { items: [{ bucket: "2026-01-01", completedCount: 4 }, { bucket: "2026-01-02", completedCount: 6 }] })
      );
    }
    if (url.includes("/admin/reports/operator/op-1/items")) {
      return Promise.resolve(jsonResponse(200, { items: [reportItem], total: 1, page: 1, pageSize: 20 }));
    }
    if (url.includes("/admin/reports/operator/op-1")) {
      return Promise.resolve(jsonResponse(200, operatorReport));
    }
    if (url.includes("/admin/users")) {
      return Promise.resolve(
        jsonResponse(200, {
          items: [{ id: "op-1", username: "op1", role: "operator", displayName: "Fulano", isActive: true, createdAt: new Date().toISOString() }],
          total: 1,
          page: 1,
          pageSize: 20,
        })
      );
    }
    if (url.includes("/admin/analytics/export")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: async () => new Blob(["conteudo"], { type: "text/csv" }),
      } as unknown as Response);
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

describe("ReportsScreen", () => {
  it("carrega o relatório por operador por padrão", async () => {
    renderScreen(buildFetchMock());

    expect(await screen.findByText("Fulano")).toBeTruthy();
    expect(screen.getByText("83%")).toBeTruthy();
  });

  it("troca pra aba por produto e carrega os dados certos", async () => {
    renderScreen(buildFetchMock());
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-by-product"));

    expect(await screen.findByText("Bolo Fake Rosa")).toBeTruthy();
  });

  it("busca de operador: digitar filtra as sugestões, e clicar numa sugestão seleciona o operador", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/admin/analytics/by-operator")) {
        return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 1, page: 1, pageSize: 20 }));
      }
      if (url.includes("/admin/reports/operator/op-2/items")) {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      }
      if (url.includes("/admin/reports/operator/op-2")) {
        return Promise.resolve(jsonResponse(200, { ...operatorReport, operator: { id: "op-2", username: "op2", displayName: "Beltrana" } }));
      }
      if (url.includes("/admin/users")) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [
              { id: "op-1", username: "op1", role: "operator", displayName: "Fulano", isActive: true, createdAt: new Date().toISOString() },
              { id: "op-2", username: "op2", role: "operator", displayName: "Beltrana", isActive: true, createdAt: new Date().toISOString() },
            ],
            total: 2,
            page: 1,
            pageSize: 100,
          })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    // busca sempre com o teto de pageSize permitido pela API — antes o
    // select ficava limitado ao padrão de 20 e escondia o resto sem avisar.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("pageSize=100"), expect.anything()));

    fireEvent.click(screen.getByTestId("tab-operator-report"));
    const search = await screen.findByTestId("operator-search");
    fireEvent.change(search, { target: { value: "Bel" } });

    expect(await screen.findByTestId("operator-suggestion-op-2")).toBeTruthy();
    expect(screen.queryByTestId("operator-suggestion-op-1")).toBeNull();

    fireEvent.click(screen.getByTestId("operator-suggestion-op-2"));

    expect(screen.queryByTestId("operator-suggestions")).toBeNull();
    expect((search as HTMLInputElement).value).toBe("Beltrana");
  });

  it("refaz a consulta quando a data é alterada", async () => {
    const fetchMock = buildFetchMock();
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.change(screen.getByTestId("date-from"), { target: { value: "2026-01-01" } });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("2026-01-01");
    });
  });

  it("mostra '-' quando a duração média/desvio padrão do produto é nula", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/admin/analytics/by-operator")) {
        return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 1, page: 1, pageSize: 20 }));
      }
      if (url.includes("/admin/analytics/by-product")) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [{ ...productRow, avgDurationSeconds: null, stddevDurationSeconds: null }],
            total: 1,
            page: 1,
            pageSize: 20,
          })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-by-product"));
    await screen.findByText("Bolo Fake Rosa");

    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("mostra '-' nos campos nulos do relatório individual", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/admin/analytics/by-operator")) {
        return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 1, page: 1, pageSize: 20 }));
      }
      if (url.includes("/admin/reports/operator/op-1/items")) {
        return Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 20 }));
      }
      if (url.includes("/admin/reports/operator/op-1")) {
        return Promise.resolve(
          jsonResponse(200, {
            ...operatorReport,
            overview: {
              ...operatorReport.overview,
              punctuality: { ...operatorReport.overview.punctuality, punctualityIndex: null, avgGapSeconds: null, durationCoefficientOfVariation: null },
            },
            byProduct: [{ ...operatorReport.byProduct[0], avgDurationSeconds: null, teamAvgDurationSeconds: null, relativeSpeedIndex: null }],
            ranking: { ...operatorReport.ranking, positionAmongOperators: null, weightedRelativeSpeedScore: null },
          })
        );
      }
      if (url.includes("/admin/users")) {
        return Promise.resolve(
          jsonResponse(200, {
            items: [{ id: "op-1", username: "op1", role: "operator", displayName: "Fulano", isActive: true, createdAt: new Date().toISOString() }],
            total: 1,
            page: 1,
            pageSize: 20,
          })
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-operator-report"));
    await screen.findByTestId("operator-search");
    fireEvent.change(screen.getByTestId("operator-search"), { target: { value: "Fulano" } });
    fireEvent.click(await screen.findByTestId("operator-suggestion-op-1"));

    expect(await screen.findByText("- de 8")).toBeTruthy();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
  });

  it("mostra erro inline quando o período é rejeitado pelo backend", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: "RANGE_TOO_LARGE", message: "O período consultado não pode exceder 90 dias." }));
    renderScreen(fetchMock);

    expect(await screen.findByText("O período consultado não pode exceder 90 dias.")).toBeTruthy();
  });

  it("aba de throughput carrega os dados e permite trocar o bucket", async () => {
    const fetchMock = buildFetchMock();
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-throughput"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/admin/analytics/throughput"))).toBe(true));

    fireEvent.click(screen.getByTestId("bucket-hour"));
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("bucket=hour");
    });
  });

  it("aba de relatório individual carrega dados do operador selecionado", async () => {
    renderScreen(buildFetchMock());
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-operator-report"));
    await screen.findByTestId("operator-search");
    fireEvent.change(screen.getByTestId("operator-search"), { target: { value: "Fulano" } });
    fireEvent.click(await screen.findByTestId("operator-suggestion-op-1"));

    expect((await screen.findAllByText("Bolo Fake Rosa")).length).toBeGreaterThan(0);
    expect(screen.getByText("2 de 8")).toBeTruthy();
  });

  it("relatório individual mostra os campos de qualidade/pontualidade/ranking que antes ficavam escondidos", async () => {
    renderScreen(buildFetchMock());
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-operator-report"));
    await screen.findByTestId("operator-search");
    fireEvent.change(screen.getByTestId("operator-search"), { target: { value: "Fulano" } });
    fireEvent.click(await screen.findByTestId("operator-suggestion-op-1"));

    expect((await screen.findAllByText("5%")).length).toBe(2);
    expect(screen.getByText("0.88")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("0.20")).toBeTruthy();
    expect(screen.getByText("1.20")).toBeTruthy();
    expect(screen.getByText("1.10")).toBeTruthy();
  });

  it("relatório individual mostra os itens do período, incluindo a observação de problema", async () => {
    renderScreen(buildFetchMock());
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("tab-operator-report"));
    await screen.findByTestId("operator-search");
    fireEvent.change(screen.getByTestId("operator-search"), { target: { value: "Fulano" } });
    fireEvent.click(await screen.findByTestId("operator-suggestion-op-1"));

    expect(await screen.findByText("Foto não bate com o pedido")).toBeTruthy();
    expect(screen.getByText("Problema")).toBeTruthy();
  });

  it("mostra os controles de paginação quando há mais itens do que o tamanho da página e busca a próxima página", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/admin/analytics/by-operator")) {
        return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 45, page: 1, pageSize: 20 }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    expect(screen.getByTestId("operator-page-label").textContent).toBe("Página 1 de 3 (45 no total)");

    fireEvent.click(screen.getByTestId("operator-page-next"));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("page=2");
    });
  });

  it("botão de exportar chama o endpoint de export com os parâmetros certos", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    try {
      const fetchMock = buildFetchMock();
      renderScreen(fetchMock);
      await screen.findByText("Fulano");

      fireEvent.click(screen.getByTestId("export-csv"));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/admin/analytics/export"));
        expect(exportCall).toBeTruthy();
        const url = exportCall![0] as string;
        expect(url).toContain("report=by-operator");
        expect(url).toContain("format=csv");
      });
      expect(URL.createObjectURL).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("botão de exportar XLSX chama o endpoint com format=xlsx", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    try {
      const fetchMock = buildFetchMock();
      renderScreen(fetchMock);
      await screen.findByText("Fulano");

      fireEvent.click(screen.getByTestId("export-xlsx"));

      await waitFor(() => {
        const exportCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/admin/analytics/export"));
        expect(String(exportCall![0])).toContain("format=xlsx");
      });
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("mostra erro genérico quando a exportação falha por um motivo que não é erro de domínio", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/admin/analytics/export")) return Promise.reject(new Error("falha de rede"));
      if (url.includes("/admin/analytics/by-operator")) {
        return Promise.resolve(jsonResponse(200, { items: [operatorRow], total: 1, page: 1, pageSize: 20 }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.click(screen.getByTestId("export-csv"));

    expect(await screen.findByText("Não foi possível exportar o relatório.")).toBeTruthy();
  });

  it("altera a data final e reconsulta, e clicar em 'Por dia' mantém o bucket diário", async () => {
    const fetchMock = buildFetchMock();
    renderScreen(fetchMock);
    await screen.findByText("Fulano");

    fireEvent.change(screen.getByTestId("date-to"), { target: { value: "2026-02-15" } });
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("2026-02-15");
    });

    fireEvent.click(screen.getByTestId("tab-throughput"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("bucket=day"))).toBe(true));
    fireEvent.click(screen.getByTestId("bucket-hour"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("bucket=hour"))).toBe(true));
    fireEvent.click(screen.getByTestId("bucket-day"));
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("bucket=day");
    });
  });
});
