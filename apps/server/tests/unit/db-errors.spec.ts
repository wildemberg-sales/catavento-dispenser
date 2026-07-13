import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../../src/lib/db-errors.js";

describe("isUniqueViolation", () => {
  it("retorna true para um erro do pg com code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("retorna false para outros códigos de erro", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("retorna true quando o code está em err.cause (erro envolto pelo Drizzle)", () => {
    expect(isUniqueViolation({ message: "Failed query", cause: { code: "23505" } })).toBe(true);
  });

  it("retorna false quando err.cause não tem code 23505", () => {
    expect(isUniqueViolation({ message: "Failed query", cause: { code: "23503" } })).toBe(false);
  });

  it("retorna false para valores que não são objetos de erro", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("erro qualquer")).toBe(false);
    expect(isUniqueViolation(new Error("sem code"))).toBe(false);
  });
});
