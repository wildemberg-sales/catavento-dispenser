import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProductImageCarousel } from "../ProductImageCarousel";

describe("ProductImageCarousel", () => {
  it("não renderiza nada quando não há imagens", async () => {
    const { toJSON } = await render(<ProductImageCarousel images={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renderiza as imagens ordenadas por posição", async () => {
    const { toJSON } = await render(
      <ProductImageCarousel
        images={[
          { url: "https://example.com/b.jpg", position: 1 },
          { url: "https://example.com/a.jpg", position: 0 },
        ]}
      />
    );
    expect(toJSON()).not.toBeNull();
  });

  it("não mostra indicadores de página quando há apenas uma imagem", async () => {
    await render(<ProductImageCarousel images={[{ url: "https://example.com/a.jpg", position: 0 }]} />);
    expect(screen.queryByTestId("carousel-dots")).toBeNull();
  });

  it("mostra um indicador de página por imagem quando há múltiplas, e destaca o ativo ao rolar", async () => {
    await render(
      <ProductImageCarousel
        images={[
          { url: "https://example.com/a.jpg", position: 0 },
          { url: "https://example.com/b.jpg", position: 1 },
          { url: "https://example.com/c.jpg", position: 2 },
        ]}
      />
    );

    expect(screen.getAllByTestId("carousel-dot")).toHaveLength(2);
    expect(screen.getByTestId("carousel-dot-active")).toBeTruthy();

    await fireEvent(screen.getByTestId("carousel-scrollview"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 900 } },
    });

    expect(screen.getAllByTestId("carousel-dot")).toHaveLength(2);
  });
});
