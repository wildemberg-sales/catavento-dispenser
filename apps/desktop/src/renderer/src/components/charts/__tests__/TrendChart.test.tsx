import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TrendChart } from "../TrendChart";

const data = [
  { label: "2026-01-01", value: 3 },
  { label: "2026-01-02", value: 7 },
  { label: "2026-01-03", value: 5 },
];

describe("TrendChart", () => {
  it("renderiza um gráfico de barras preenchendo a largura do container (responsivo)", () => {
    const { container } = render(<TrendChart data={data} xKey="label" yKey="value" variant="bar" height={200} />);

    const responsiveContainer = container.querySelector(".recharts-responsive-container");
    expect(responsiveContainer).toBeTruthy();
    const svg = container.querySelector("svg.recharts-surface");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("height")).toBe("200");
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3);
  });

  it("renderiza um gráfico de linha quando variant é line", () => {
    const { container } = render(<TrendChart data={data} xKey="label" yKey="value" variant="line" />);

    expect(container.querySelector(".recharts-line")).toBeTruthy();
    expect(container.querySelector(".recharts-bar")).toBeNull();
  });

  it("com dateTimeAxis, renderiza sem quebrar e reserva mais altura pro eixo X (duas linhas)", () => {
    const dateTimeData = [
      { bucket: "2026-03-05T09:07:03.000Z", value: 3 },
      { bucket: "2026-03-06T14:00:00.000Z", value: 5 },
    ];
    const { container } = render(
      <TrendChart data={dateTimeData} xKey="bucket" yKey="value" variant="bar" dateTimeAxis height={200} />
    );

    const svg = container.querySelector("svg.recharts-surface");
    expect(svg).toBeTruthy();
    const axisLine = container.querySelector(".recharts-cartesian-axis-line");
    expect(axisLine?.getAttribute("height")).toBe("44");
  });
});
