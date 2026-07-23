import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateTimeCell } from "../DateTimeCell";

describe("DateTimeCell", () => {
  it("mostra a data numa linha e a hora em outra, abaixo", () => {
    render(<DateTimeCell value={new Date(2026, 2, 5, 9, 7, 3)} />);

    expect(screen.getByText("05/03/2026")).toBeTruthy();
    expect(screen.getByText("09:07:03")).toBeTruthy();
  });
});
