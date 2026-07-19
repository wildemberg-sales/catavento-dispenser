import { useEffect, useRef } from "react";

export type MonitorEvent =
  | { type: "item_assigned"; payload: { queueItemId: string; operatorId: string; queueSize: number } }
  | { type: "item_completed"; payload: { queueItemId: string; operatorId: string; outcome: string } }
  | { type: "operator_online"; payload: { operatorId: string } }
  | { type: "operator_offline"; payload: { operatorId: string } }
  | { type: "queue_size_changed"; payload: { queueSize: number } };

const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000, 10000];

function parseFrame(frame: string): MonitorEvent | null {
  let eventType: string | null = null;
  let dataLine: string | null = null;

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) eventType = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLine = line.slice("data:".length).trim();
  }

  if (!eventType || dataLine === null) return null;
  try {
    return { type: eventType, payload: JSON.parse(dataLine) } as MonitorEvent;
  } catch {
    return null;
  }
}

export function useMonitorStream(options: {
  baseUrl: string;
  getAccessToken: () => string | null;
  onEvent: (event: MonitorEvent) => void;
  fetchImpl?: typeof fetch;
  backoffMs?: number[];
}): void {
  const { baseUrl, fetchImpl, backoffMs } = options;

  // onEvent/getAccessToken normalmente mudam de identidade a cada render do
  // componente que chama este hook (novas closures capturando estado fresco,
  // como o mapa de nomes de operador em MonitorScreen). A conexão SSE em si
  // não deve ser derrubada e reaberta por causa disso — só quando `baseUrl`
  // muda — então sempre chamamos a versão mais recente via ref, em vez de
  // fechar sobre os valores de quando o efeito rodou pela primeira vez.
  const onEventRef = useRef(options.onEvent);
  const getAccessTokenRef = useRef(options.getAccessToken);
  useEffect(() => {
    onEventRef.current = options.onEvent;
    getAccessTokenRef.current = options.getAccessToken;
  });

  useEffect(() => {
    const fetchFn = fetchImpl ?? fetch;
    const delays = backoffMs ?? DEFAULT_BACKOFF_MS;
    const controller = new AbortController();
    let stopped = false;

    async function connectOnce(): Promise<void> {
      const token = getAccessTokenRef.current();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetchFn(`${baseUrl}/admin/stream`, { headers, signal: controller.signal });
      if (!response.ok || !response.body) {
        throw new Error(`monitor stream indisponível: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let frameEnd = buffer.indexOf("\n\n");
        while (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);
          const parsed = parseFrame(frame);
          if (parsed) onEventRef.current(parsed);
          frameEnd = buffer.indexOf("\n\n");
        }
      }
    }

    async function loop(): Promise<void> {
      let attempt = 0;
      while (!stopped) {
        try {
          await connectOnce();
        } catch {
          // Rede indisponível ou stream encerrado — reconecta com backoff.
        }
        if (stopped) break;
        const delay = delays[Math.min(attempt, delays.length - 1)]!;
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    void loop();

    return () => {
      stopped = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);
}
