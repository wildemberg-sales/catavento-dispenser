import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DateTimeAxisTick } from "../DateTimeAxisTick";

describe("DateTimeAxisTick", () => {
  it("renderiza a data numa linha e a hora em outra, abaixo", () => {
    const { container } = render(
      <svg>
        <DateTimeAxisTick x={10} y={20} payload={{ value: new Date(2026, 2, 5, 9, 7, 3) }} />
      </svg>
    );

    const texts = container.querySelectorAll("text");
    expect(texts).toHaveLength(2);
    expect(texts[0]!.textContent).toBe("05/03/2026");
    expect(texts[1]!.textContent).toBe("09:07:03");
    expect(Number(texts[1]!.getAttribute("dy"))).toBeGreaterThan(Number(texts[0]!.getAttribute("dy")));
  });

  it("não renderiza nada quando não recebe payload", () => {
    const { container } = render(
      <svg>
        <DateTimeAxisTick x={0} y={0} />
      </svg>
    );

    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
});
