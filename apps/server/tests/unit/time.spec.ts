import { describe, expect, it } from "vitest";
import { calculateDurationSeconds } from "../../src/lib/time.js";

describe("calculateDurationSeconds", () => {
  it("calcula a diferença em segundos entre início e fim", () => {
    const started = new Date("2026-01-01T10:00:00.000Z");
    const completed = new Date("2026-01-01T10:05:30.000Z");
    expect(calculateDurationSeconds(started, completed)).toBe(330);
  });

  it("arredonda milissegundos para o segundo mais próximo", () => {
    const started = new Date("2026-01-01T10:00:00.000Z");
    const completed = new Date("2026-01-01T10:00:00.600Z");
    expect(calculateDurationSeconds(started, completed)).toBe(1);
  });

  it("nunca retorna um valor negativo, mesmo com clock incoerente", () => {
    const started = new Date("2026-01-01T10:00:05.000Z");
    const completed = new Date("2026-01-01T10:00:00.000Z");
    expect(calculateDurationSeconds(started, completed)).toBe(0);
  });

  it("retorna 0 quando início e fim são o mesmo instante", () => {
    const instant = new Date("2026-01-01T10:00:00.000Z");
    expect(calculateDurationSeconds(instant, instant)).toBe(0);
  });
});
