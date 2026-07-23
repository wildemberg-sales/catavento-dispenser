import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom não faz layout de verdade (getBoundingClientRect sempre retorna zero)
// nem implementa ResizeObserver — o recharts <ResponsiveContainer> (usado
// pelos gráficos responsivos) precisa dos dois pra medir o container e
// desenhar o SVG. Sem isso, os gráficos "renderizariam" com 0x0 nos testes.
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverMock;

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    width: 600,
    height: 300,
    top: 0,
    left: 0,
    right: 600,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON() {},
  }),
});
