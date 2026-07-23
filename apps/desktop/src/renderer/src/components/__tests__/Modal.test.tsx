import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("mostra o título e o conteúdo", () => {
    render(
      <Modal title="Editar usuário" onClose={() => {}}>
        <p>conteúdo do modal</p>
      </Modal>
    );

    expect(screen.getByText("Editar usuário")).toBeTruthy();
    expect(screen.getByText("conteúdo do modal")).toBeTruthy();
  });

  it("chama onClose ao clicar no botão de fechar", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Editar usuário" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("chama onClose ao clicar fora do card (no overlay)", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Editar usuário" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não chama onClose ao clicar dentro do card", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Editar usuário" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>
    );

    fireEvent.click(screen.getByText("conteúdo"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
