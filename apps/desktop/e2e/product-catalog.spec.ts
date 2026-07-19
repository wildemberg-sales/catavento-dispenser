import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("cadastra um produto com foto, itens de montagem e SKU", async () => {
  const runId = Date.now();
  const productName = `Bolo Fake E2E ${runId}`;
  const imagePath = path.join(os.tmpdir(), `catavento-e2e-foto-${runId}.png`);
  fs.writeFileSync(imagePath, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));

  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);

    await window.getByText("Produtos").click();
    await window.getByTestId("new-product-button").click();

    await window.getByTestId("product-name").fill(productName);
    await window.getByTestId("assembly-item-input").fill("Base de isopor");
    await window.getByTestId("add-assembly-item").click();
    await window.getByTestId("sku-mercado_livre").fill(`SKU-E2E-${runId}`);
    await window.getByTestId("product-submit").click();

    await window.getByText("🧁 Fotos do produto").waitFor();

    await window.getByTestId("upload-image-input").setInputFiles(imagePath);
    const deleteButton = window.locator('[data-testid^="delete-image-"]');
    await expect(deleteButton).toBeVisible();

    await window.getByText("Produtos").click();
    // A lista ordena por nome e roda contra o Postgres local persistente —
    // dezenas de produtos de execuções anteriores já acumularam aqui, então
    // o item recém-criado não necessariamente cai na primeira página.
    // Filtrar pelo nome único evita depender de paginação/ordenação.
    await window.getByTestId("products-search").fill(productName);
    await expect(window.getByText(productName)).toBeVisible();
  } finally {
    await app.close();
    fs.unlinkSync(imagePath);
  }
});
