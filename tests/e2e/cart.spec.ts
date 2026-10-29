import { test, expect } from "@playwright/test";
// Fixed cart content seeded through the real REST handlers of the normal build.
test("referência visual: carrinho", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-01T00:00:00.000Z"));
  await page.goto("/");
  // The first catalog card proves MSW is serving before seeding the cart.
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await page.evaluate(async () => {
    const session = await fetch("/api/visitor-sessions", { method: "POST" });
    const token = ((await session.json()) as { data: { token: string } }).data
      .token;
    localStorage.setItem("kurio.visitor.v1", token);
    for (const [nftId, editionId, quantity] of [
      ["nft-001", "edition-1-limited", 2],
      ["nft-005", "edition-5-limited", 5],
      ["nft-003", "edition-3-limited", 3],
    ] as const)
      await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Visitor-Token": token,
        },
        body: JSON.stringify({ nftId, editionId, quantity }),
      });
  });
  await page.goto("/cart");
  await expect(page.locator(".cart-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".carousel .nft-card").first()).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(images.map((image) => image.decode()));
  });
  await expect(page).toHaveScreenshot("carrinho.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});
