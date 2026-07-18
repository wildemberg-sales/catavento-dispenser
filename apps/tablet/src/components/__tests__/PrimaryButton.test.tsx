import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { PrimaryButton } from "../PrimaryButton";

function flattenStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style : [style]).filter(Boolean));
}

describe("PrimaryButton", () => {
  it("chama onPress ao tocar", async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton testID="btn" title="Concluir" onPress={onPress} />);

    await fireEvent.press(screen.getByTestId("btn"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reduz a opacidade quando desabilitado", async () => {
    await render(<PrimaryButton testID="btn" title="Concluir" onPress={jest.fn()} disabled />);

    const style = flattenStyle(screen.getByTestId("btn").props.style);
    expect(style.opacity).toBe(0.5);
  });

  it("reduz a opacidade ao ser pressionado e volta ao soltar", async () => {
    await render(<PrimaryButton testID="btn" title="Concluir" onPress={jest.fn()} />);

    await fireEvent(screen.getByTestId("btn"), "pressIn");
    expect(flattenStyle(screen.getByTestId("btn").props.style).opacity).toBe(0.85);

    await fireEvent(screen.getByTestId("btn"), "pressOut");
    expect(flattenStyle(screen.getByTestId("btn").props.style).opacity).toBe(1);
  });
});
