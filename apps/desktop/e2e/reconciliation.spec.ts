import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("resolve um item sem vínculo cadastrando o produto pela tela de reconciliação", async () => {
  const runId = Date.now();
  const uniqueRef = `E2E-RECON-${runId}`;
  const csvPath = path.join(os.tmpdir(), `catavento-e2e-recon-${runId}.csv`);
  fs.writeFileSync(csvPath, `sku,fonte,produto\n${uniqueRef},Mercado Livre,Bolo fake sem vínculo\n`);

  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);

    await window.getByTestId("new-import-button").click();
    await window.getByTestId("upload-file-input").setInputFiles(csvPath);
    await window.getByTestId("upload-submit").click();
    await window.getByTestId("mapping-confirm").waitFor();
    await window.getByTestId("mapping-confirm").click();

    await window.getByText("Sem vínculo").click();
    const item = window.locator(".card", { hasText: uniqueRef });
    await expect(item).toBeVisible();
    await item.getByText("Cadastrar produto").click();

    await expect(window.getByTestId("product-name")).toHaveValue(uniqueRef);
    await window.getByTestId("product-submit").click();

    await window.getByText("🧁 Fotos do produto").waitFor();

    await window.getByText("Sem vínculo").click();
    await expect(window.getByText(uniqueRef)).toHaveCount(0);
  } finally {
    await app.close();
    fs.unlinkSync(csvPath);
  }
});
