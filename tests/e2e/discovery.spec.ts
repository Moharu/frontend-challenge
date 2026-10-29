import { test, expect } from "@playwright/test";
test("descoberta, detalhe e carrinho carregam sem erros ou ponte de testes no build normal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "SEJA DONO",
  );
  await expect(
    page.getByRole("link", { name: "Ver Emerald Ape #042", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => "__KURIO_TEST__" in window)).toBe(false);
  await page
    .getByRole("link", { name: "Ver Emerald Ape #042", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aberta — Esgotada" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await expect(page.locator("#cart-feedback")).toContainText(
    "adicionado ao carrinho",
  );
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Conectar e finalizar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "O checkout ainda não está disponível",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

for (const [name, path] of [
  ["inicio", "/"],
  ["detalhe", "/nfts/nft-001"],
] as const) {
  test(`referência visual: ${name}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-01-01T00:00:00.000Z"));
    await page.goto(path);
    if (name === "inicio")
      await expect(page.locator(".nft-grid .nft-card")).toHaveCount(9);
    else await expect(page.locator(".related .nft-card")).toHaveCount(5);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      images.forEach((image) => {
        image.loading = "eager";
      });
      await Promise.all(images.map((image) => image.decode()));
    });
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}
