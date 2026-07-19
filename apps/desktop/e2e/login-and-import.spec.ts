import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("login como admin, importa uma planilha e vê os itens na gestão de fila", async () => {
  const runId = Date.now();
  const ref1 = `E2E-BOLO-${runId}-1`;
  const ref2 = `E2E-BOLO-${runId}-2`;
  const csvPath = path.join(os.tmpdir(), `catavento-e2e-import-${runId}.csv`);
  fs.writeFileSync(
    csvPath,
    `sku,fonte,produto\n${ref1},Mercado Livre,Bolo fake e2e teste 1\n${ref2},Shopee,Bolo fake e2e teste 2\n`
  );

  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);

    await window.getByTestId("new-import-button").click();
    await window.getByTestId("upload-file-input").setInputFiles(csvPath);
    await window.getByTestId("upload-submit").click();

    await window.getByTestId("mapping-confirm").waitFor();
    await window.getByTestId("mapping-confirm").click();

    await expect(window.getByText("catavento-e2e-import")).toBeVisible();

    await window.getByRole("link", { name: "Fila" }).click();
    await window.getByTestId("status-filter").waitFor();
    await expect(window.getByRole("cell", { name: ref1, exact: true })).toBeVisible();
    await expect(window.getByRole("cell", { name: ref2, exact: true })).toBeVisible();
  } finally {
    await app.close();
    fs.unlinkSync(csvPath);
  }
});
