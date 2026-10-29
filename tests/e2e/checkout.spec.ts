import { test, expect } from "@playwright/test";
// Checkout reference: desktop single page and the mobile wallet step, signed
// in as the fictional Ada through the real REST handlers of the normal build.
test("referência visual: pagamento", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  await page.clock.setFixedTime(new Date("2026-01-01T00:00:00.000Z"));
  await page.goto("/");
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await page.evaluate(async () => {
    const response = await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ada@example.test",
        password: "AdaKurio2026",
      }),
    });
    const token = ((await response.json()) as { data: { token: string } }).data
      .token;
    localStorage.setItem("kurio.session.v1", token);
    for (const [nftId, editionId, quantity] of [
      ["nft-001", "edition-1-limited", 2],
      ["nft-005", "edition-5-limited", 5],
      ["nft-003", "edition-3-limited", 3],
    ] as const)
      await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nftId, editionId, quantity }),
      });
  });
  await page.goto(mobile ? "/checkout?step=carteira" : "/checkout");
  await expect(page.locator("#connection-status")).toContainText(
    "MetaMask conectada",
  );
  if (!mobile)
    await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
  else
    await expect(page.locator(".checkout-mobile-total strong")).not.toHaveText(
      "—",
    );
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(images.map((image) => image.decode()));
  });
  await expect(page).toHaveScreenshot("pagamento.png", {
    // Mobile: the viewport, as on a phone. A full-page capture draws the
    // sticky action bar in the middle of the page.
    fullPage: !mobile,
    animations: "disabled",
    caret: "hide",
    // Transient announcements are not part of the composition.
    mask: [page.locator(".notices")],
  });
});
