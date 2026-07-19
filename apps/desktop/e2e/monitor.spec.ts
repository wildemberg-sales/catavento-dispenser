import { test, expect, request as playwrightRequest } from "@playwright/test";
import { launchApp, login, tempUserDataDir } from "./helpers.js";

test("monitor ao vivo atualiza o tamanho da fila quando uma importação é confirmada em outra sessão", async () => {
  const runId = Date.now();
  const { app, window } = await launchApp(tempUserDataDir());
  const api = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });

  try {
    await login(window);
    await window.getByText("Monitor").click();
    await window.getByTestId("queue-size-value").waitFor();

    const initialText = await window.getByTestId("queue-size-value").textContent();
    const initialSize = Number(initialText);

    const loginRes = await api.post("/auth/login", { data: { username: "admin", password: "admin123" } });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = await loginRes.json();

    const csv = `sku,fonte,produto\nE2E-MONITOR-${runId}-1,Mercado Livre,Bolo fake monitor 1\nE2E-MONITOR-${runId}-2,Shopee,Bolo fake monitor 2\n`;
    const uploadRes = await api.post("/admin/imports/", {
      headers: { Authorization: `Bearer ${accessToken}` },
      multipart: { file: { name: `monitor-${runId}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(uploadRes.ok()).toBeTruthy();
    const preview = await uploadRes.json();

    const confirmRes = await api.post(`/admin/imports/${preview.batchId}/confirm`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { columnMapping: preview.suggestedMapping },
    });
    expect(confirmRes.ok()).toBeTruthy();

    await expect(window.getByTestId("queue-size-value")).toHaveText(String(initialSize + 2), { timeout: 10000 });
  } finally {
    await api.dispose();
    await app.close();
  }
});
