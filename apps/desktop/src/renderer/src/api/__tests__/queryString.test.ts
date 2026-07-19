import { describe, expect, it } from "vitest";
import { buildQueryString } from "../queryString";

describe("buildQueryString", () => {
  it("monta a querystring com os parâmetros informados", () => {
    expect(buildQueryString({ search: "bolo", page: 2, includeInactive: true })).toBe(
      "?search=bolo&page=2&includeInactive=true"
    );
  });

  it("omite parâmetros indefinidos", () => {
    expect(buildQueryString({ search: undefined, page: 1 })).toBe("?page=1");
  });

  it("retorna string vazia quando não há parâmetros definidos", () => {
    expect(buildQueryString({ search: undefined })).toBe("");
  });
});
