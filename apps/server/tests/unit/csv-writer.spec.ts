import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/lib/csv-writer.js";

describe("toCsv", () => {
  it("gera header + linha para um registro simples", () => {
    const csv = toCsv([{ a: 1, b: "x" }], [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
    ]);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("A,B");
    expect(lines[1]).toBe("1,x");
  });

  it("escapa valores com vírgula, aspas e quebra de linha (RFC 4180)", () => {
    const csv = toCsv(
      [{ nome: 'Produto "especial", com vírgula' }, { nome: "linha1\nlinha2" }],
      [{ key: "nome", header: "Nome" }]
    );
    const body = csv.replace(/^﻿/, "");
    expect(body).toContain('"Produto ""especial"", com vírgula"');
    expect(body).toContain('"linha1\nlinha2"');
  });

  it("prefixa BOM UTF-8 para abrir corretamente acentuação no Excel", () => {
    const csv = toCsv([{ nome: "Ação" }], [{ key: "nome", header: "Nome" }]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("lida com valores nulos/indefinidos como célula vazia", () => {
    const csv = toCsv([{ a: null, b: undefined }], [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
    ]);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[1]).toBe(",");
  });

  it("gera apenas o header quando não há linhas", () => {
    const csv = toCsv([], [{ key: "a", header: "A" }]);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toEqual(["A"]);
  });
});
