import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("cria, desativa, reativa e redefine a senha de um usuário", async () => {
  const runId = Date.now();
  const username = `e2e-user-${runId}`;
  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);
    await window.getByText("Usuários").click();

    await window.getByTestId("new-user-button").click();
    await window.getByTestId("user-username").fill(username);
    await window.getByTestId("user-password").fill(`senha-${runId}`);
    await window.getByTestId("user-displayname").fill(`E2E User ${runId}`);
    await window.getByTestId("user-submit").click();

    await window.getByText(username).waitFor();
    const row = window.locator("tr", { hasText: username });
    await expect(row).toBeVisible();

    const deactivateButton = row.locator('[data-testid^="deactivate-"]');
    await deactivateButton.click();
    await expect(row.getByText("Inativo")).toBeVisible();

    const reactivateButton = row.locator('[data-testid^="reactivate-"]');
    await reactivateButton.click();
    await expect(row.getByText("Ativo")).toBeVisible();

    const resetButton = row.locator('[data-testid^="reset-password-"]');
    await resetButton.click();
    const passwordInput = row.locator('[data-testid^="reset-password-input-"]');
    await passwordInput.fill(`nova-senha-${runId}`);
    const confirmButton = row.locator('[data-testid^="reset-password-confirm-"]');
    await confirmButton.click();
    await expect(passwordInput).toHaveCount(0);
  } finally {
    await app.close();
  }
});
