import { describe, expect, it } from "vitest";
import { parseAllowedOrigins, resolveCorsOrigin } from "../../src/lib/cors-origins.js";

describe("parseAllowedOrigins", () => {
  it("retorna null (sem restrição) para uma string vazia", () => {
    expect(parseAllowedOrigins("")).toBeNull();
    expect(parseAllowedOrigins("   ")).toBeNull();
  });

  it("separa uma lista por vírgulas, removendo espaços em volta", () => {
    expect(parseAllowedOrigins("https://a.com, https://b.com ,https://c.com")).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]);
  });

  it("aceita uma única origem sem vírgula", () => {
    expect(parseAllowedOrigins("https://admin.exemplo.com")).toEqual(["https://admin.exemplo.com"]);
  });
});

describe("resolveCorsOrigin", () => {
  it("retorna null quando não há header Origin, independente da allowlist", () => {
    expect(resolveCorsOrigin(undefined, null)).toBeNull();
    expect(resolveCorsOrigin(undefined, ["https://a.com"])).toBeNull();
  });

  it("reflete qualquer origem quando allowedOrigins é null (sem restrição)", () => {
    expect(resolveCorsOrigin("https://qualquer-coisa.com", null)).toBe("https://qualquer-coisa.com");
  });

  it("reflete a origem quando ela está na allowlist", () => {
    expect(resolveCorsOrigin("https://a.com", ["https://a.com", "https://b.com"])).toBe("https://a.com");
  });

  it("retorna null quando a origem não está na allowlist", () => {
    expect(resolveCorsOrigin("https://nao-listada.com", ["https://a.com"])).toBeNull();
  });
});
