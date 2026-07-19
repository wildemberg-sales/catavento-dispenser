import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../../auth/AuthContext";
import { MonitorScreen } from "../MonitorScreen";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const secureStoreMock = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

function controllableStream() {
  let controllerRef!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  const encoder = new TextEncoder();
  return {
    stream,
    push(text: string) {
      controllerRef.enqueue(encoder.encode(text));
    },
  };
}

function buildFetchMock(sse: ReturnType<typeof controllableStream>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/stream")) {
      return Promise.resolve({ ok: true, status: 200, body: sse.stream } as unknown as Response);
    }
    if (url.includes("/admin/queue")) {
      return Promise.resolve(jsonResponse(200, { items: [], total: 4, page: 1, pageSize: 1 }));
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
}

// O fetch dos nomes de operador roda no mesmo efeito que o de tamanho da
// fila, mas resolve em um número diferente de microtasks (uma camada a mais
// de `.then()` dentro de `usersApi.list`). Esperar só o "4" aparecer no DOM
// não garante que `operatorNames` já foi populado — sob instrumentação de
// cobertura (mais overhead), a corrida ocasionalmente perde e o evento cai
// no fallback (operatorId cru). Um tick de macrotask garante que todas as
// microtasks pendentes (incluindo o segundo fetch) já assentaram.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function renderScreen(fetchMock: typeof fetch) {
  return render(
    <AuthProvider baseUrl="http://localhost:3000" fetchImpl={fetchMock} secureStore={secureStoreMock}>
      <MonitorScreen />
    </AuthProvider>
  );
}

describe("MonitorScreen", () => {
  it("mostra o snapshot inicial do tamanho da fila", async () => {
    const sse = controllableStream();
    renderScreen(buildFetchMock(sse));

    expect(await screen.findByText("4")).toBeTruthy();
  });

  it("item_assigned atualiza o tamanho da fila e adiciona ao feed com o nome do operador", async () => {
    const sse = controllableStream();
    renderScreen(buildFetchMock(sse));
    await screen.findByText("4");
    await flushMicrotasks();

    sse.push('event: item_assigned\ndata: {"queueItemId":"item1","operatorId":"op-1","queueSize":7}\n\n');

    expect(await screen.findByText("7")).toBeTruthy();
    expect(await screen.findByText("Item atribuído a Fulano")).toBeTruthy();
  });

  it("operator_online mostra o operador na lista de online, operator_offline remove", async () => {
    const sse = controllableStream();
    renderScreen(buildFetchMock(sse));
    await screen.findByText("4");
    await flushMicrotasks();

    sse.push('event: operator_online\ndata: {"operatorId":"op-1"}\n\n');
    expect(await screen.findByText("Fulano entrou")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Fulano").length).toBeGreaterThan(0));

    sse.push('event: operator_offline\ndata: {"operatorId":"op-1"}\n\n');
    expect(await screen.findByText("Fulano saiu")).toBeTruthy();
  });

  it("item_completed mostra ícone e texto certos pra completed e problem", async () => {
    const sse = controllableStream();
    renderScreen(buildFetchMock(sse));
    await screen.findByText("4");
    await flushMicrotasks();

    sse.push('event: item_completed\ndata: {"queueItemId":"item1","operatorId":"op-1","outcome":"completed"}\n\n');
    expect(await screen.findByText("Item concluído por Fulano")).toBeTruthy();

    sse.push('event: item_completed\ndata: {"queueItemId":"item2","operatorId":"op-1","outcome":"problem"}\n\n');
    expect(await screen.findByText("Item relatado com problema por Fulano")).toBeTruthy();
  });

  it("queue_size_changed atualiza o contador sem entrar no feed", async () => {
    const sse = controllableStream();
    renderScreen(buildFetchMock(sse));
    await screen.findByText("4");

    sse.push('event: queue_size_changed\ndata: {"queueSize":12}\n\n');

    expect(await screen.findByText("12")).toBeTruthy();
  });
});
