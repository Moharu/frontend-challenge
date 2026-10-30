import { test, expect } from "@playwright/test";
// Without a service worker (blocked or unsupported) the simulated API cannot
// run: the page says so instead of staying blank or failing on JSON.
test.use({ serviceWorkers: "block" });
test("sem service worker: mensagem clara, sem tela em branco", async ({
  page,
}) => {
  await page.goto("/");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Não foi possível iniciar a demonstração");
  await expect(alert).toContainText("service worker");
});
