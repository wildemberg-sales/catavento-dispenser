import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("sessão persiste entre reinícios do app via refresh token salvo no safeStorage", async () => {
  const userDataDir = tempUserDataDir();

  const first = await launchApp(userDataDir);
  await login(first.window);
  await first.app.close();

  const second = await launchApp(userDataDir);
  try {
    await expect(second.window.getByText("Importações").first()).toBeVisible();
    await expect(second.window.getByTestId("login-username")).toHaveCount(0);
  } finally {
    await second.app.close();
  }
});
