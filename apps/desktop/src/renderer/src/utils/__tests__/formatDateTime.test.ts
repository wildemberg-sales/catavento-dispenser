import { describe, expect, it } from "vitest";
import { formatDateTime } from "../formatDateTime";

describe("formatDateTime", () => {
  it("formata uma data ISO com hora em dd/mm/yyyy e HH:mm:ss", () => {
    const d = new Date(2026, 2, 5, 9, 7, 3);
    expect(formatDateTime(d)).toEqual({ date: "05/03/2026", time: "09:07:03" });
  });

  it("aceita uma string ISO e faz o parse", () => {
    const d = new Date("2026-01-01T00:00:00");
    const result = formatDateTime("2026-01-01T00:00:00");
    expect(result.date).toBe(formatDateTime(d).date);
    expect(result.time).toBe("00:00:00");
  });

  it("preenche com zero à esquerda dia, mês, hora, minuto e segundo", () => {
    const d = new Date(2026, 0, 1, 1, 2, 3);
    expect(formatDateTime(d)).toEqual({ date: "01/01/2026", time: "01:02:03" });
  });
});
