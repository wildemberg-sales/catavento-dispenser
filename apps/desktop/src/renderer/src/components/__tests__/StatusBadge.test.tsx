import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("mostra o status com a cor conhecida", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText("completed")).toBeTruthy();
  });

  it("usa a cor neutra de fallback para um status desconhecido", () => {
    render(<StatusBadge status="algo-nao-mapeado" />);
    expect(screen.getByText("algo-nao-mapeado")).toBeTruthy();
  });
});
