import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_PATH = path.resolve(__dirname, "../out/main/index.js");

export function tempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "catavento-e2e-"));
}

export async function launchApp(userDataDir: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({ args: [MAIN_PATH, `--user-data-dir=${userDataDir}`] });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return { app, window };
}

export async function login(window: Page, username = "admin", password = "admin123"): Promise<void> {
  await window.getByTestId("login-username").waitFor();
  await window.getByTestId("login-username").fill(username);
  await window.getByTestId("login-password").fill(password);
  await window.getByTestId("login-submit").click();
  await window.getByText("Importações").first().waitFor();
}
