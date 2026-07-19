import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMonitorStream, type MonitorEvent } from "../useMonitorStream";

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function okResponse(body: ReadableStream<Uint8Array>): Response {
  return { ok: true, status: 200, body } as unknown as Response;
}

describe("useMonitorStream", () => {
  it("parseia eventos nomeados e ignora comentários de heartbeat", async () => {
    const frames =
      ": connected\n\n" +
      'event: item_assigned\ndata: {"queueItemId":"item1","operatorId":"op1","queueSize":3}\n\n' +
      ": ping\n\n" +
      'event: operator_online\ndata: {"operatorId":"op1"}\n\n';
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(streamFrom(frames)));
    const onEvent = vi.fn();

    const { unmount } = renderHook(() =>
      useMonitorStream({ baseUrl: "http://localhost:3000", getAccessToken: () => "token-abc", onEvent, fetchImpl })
    );

    await waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: "item_assigned",
      payload: { queueItemId: "item1", operatorId: "op1", queueSize: 3 },
    } satisfies MonitorEvent);
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      type: "operator_online",
      payload: { operatorId: "op1" },
    } satisfies MonitorEvent);
    unmount();
  });

  it("envia o access token atual como header Authorization", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(streamFrom("")));
    const { unmount } = renderHook(() =>
      useMonitorStream({
        baseUrl: "http://localhost:3000",
        getAccessToken: () => "meu-token",
        onEvent: vi.fn(),
        fetchImpl,
      })
    );

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [url, options] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/admin/stream");
    expect((options as RequestInit).headers).toEqual({ Authorization: "Bearer meu-token" });
    unmount();
  });

  it("reconecta com backoff após uma falha de conexão", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("conexão perdida"))
      .mockImplementation(() =>
        Promise.resolve(okResponse(streamFrom('event: queue_size_changed\ndata: {"queueSize":9}\n\n')))
      );
    const onEvent = vi.fn();

    const { unmount } = renderHook(() =>
      useMonitorStream({
        baseUrl: "http://localhost:3000",
        getAccessToken: () => "token-abc",
        onEvent,
        fetchImpl,
        backoffMs: [0],
      })
    );

    await waitFor(() => expect(onEvent).toHaveBeenCalledWith({ type: "queue_size_changed", payload: { queueSize: 9 } }));
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it("para de tentar reconectar depois do unmount", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("conexão perdida"));

    const { unmount } = renderHook(() =>
      useMonitorStream({
        baseUrl: "http://localhost:3000",
        getAccessToken: () => "token-abc",
        onEvent: vi.fn(),
        fetchImpl,
        backoffMs: [0],
      })
    );

    await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(1));
    unmount();
    const callsAtUnmount = fetchImpl.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(fetchImpl.mock.calls.length).toBe(callsAtUnmount);
  });
});
