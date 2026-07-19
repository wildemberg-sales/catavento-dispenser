import { test, expect } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("navega pelas abas de relatórios contra o backend real", async () => {
  // O clique real de exportar (download via blob + <a download>) não é
  // testado aqui de propósito: já é coberto em detalhe pelos testes
  // unitários de ReportsScreen (parâmetros corretos, tratamento de erro), e
  // disparar o download real do Electron nesse ambiente e2e demonstrou um
  // efeito colateral real no SO que ocasionalmente atrasava o processo
  // Electron do PRÓXIMO teste da suíte — não vale o custo de estabilidade
  // pra uma asserção que já está coberta em outro nível.
  const { app, window } = await launchApp(tempUserDataDir());

  try {
    await login(window);
    await window.getByText("Relatórios").click();

    await window.getByTestId("date-from").waitFor();
    await window.getByTestId("tab-by-operator").waitFor();

    await window.getByTestId("tab-by-product").click();
    await window.getByTestId("tab-throughput").click();
    await window.getByTestId("bucket-hour").click();
    await expect(window.locator("svg.recharts-surface")).toBeVisible();

    await window.getByTestId("tab-operator-report").click();
    await window.getByTestId("operator-select").waitFor();
  } finally {
    await app.close();
  }
});
