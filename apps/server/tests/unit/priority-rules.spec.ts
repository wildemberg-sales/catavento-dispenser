import { describe, expect, it } from "vitest";
import { resolvePriority } from "../../src/modules/queue/priority-rules.js";

describe("resolvePriority", () => {
  const rulesMap = new Map([
    ["mercado_livre", 2],
    ["shopee", 1],
    ["ebay", 0],
  ] as const);

  it("usa a regra da fonte quando não há override", () => {
    expect(resolvePriority("mercado_livre", null, rulesMap)).toBe(2);
  });

  it("override explícito do arquivo vence a regra da fonte", () => {
    expect(resolvePriority("shopee", 99, rulesMap)).toBe(99);
  });

  it("fonte ausente do mapa retorna fallback 0", () => {
    const emptyMap = new Map<string, number>();
    expect(resolvePriority("ebay", null, emptyMap)).toBe(0);
  });
});
