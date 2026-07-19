import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("cancelar e repor um item na fila, e salvar regras de prioridade", async () => {
  const uniqueRef = `E2E-RULES-${Date.now()}`;
  const csvPath = path.join(os.tmpdir(), `catavento-e2e-${Date.now()}.csv`);
  fs.writeFileSync(csvPath, `sku,fonte,produto\n${uniqueRef},Mercado Livre,Bolo fake e2e regras\n`);

  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);

    await window.getByTestId("new-import-button").click();
    await window.getByTestId("upload-file-input").setInputFiles(csvPath);
    await window.getByTestId("upload-submit").click();
    await window.getByTestId("mapping-confirm").waitFor();
    await window.getByTestId("mapping-confirm").click();

    await window.getByText("Fila").click();
    const row = window.locator("tr", { hasText: uniqueRef });
    await expect(row).toBeVisible();

    await row.getByText("Cancelar").click();
    await expect(row.getByText("cancelled")).toBeVisible();

    await row.getByText("Repor na fila").click();
    await expect(row.getByText("pending")).toBeVisible();

    await window.getByTestId("priority-mercado_livre").fill("5");
    await window.getByTestId("priority-save").click();
    await expect(window.getByText("Regras de prioridade atualizadas.")).toBeVisible();
  } finally {
    await app.close();
    fs.unlinkSync(csvPath);
  }
});
