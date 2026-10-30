import { test, expect } from "@playwright/test";
// Confirmed receipt reference (desktop and mobile), on the normal build. The
// purchase goes through the real REST handlers; the clock is pinned so the
// confirmation date is stable, then moved past the simulated payment delay.
test("referência visual: recibo confirmado", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-29T12:00:00.000Z"));
  await page.goto("/");
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  const orderId = await page.evaluate(async () => {
    const json = (r: Response) => r.json() as Promise<{ data: never }>;
    const login = await json(
      await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.test",
          password: "AdaKurio2026",
        }),
      }),
    );
    const token = (login.data as { token: string }).token;
    localStorage.setItem("kurio.session.v1", token);
    const headers = {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const post = (path: string, body: unknown, extra = {}) =>
      fetch(`/api${path}`, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(body),
      }).then(json);
    for (const [nftId, editionId, quantity] of [
      ["nft-001", "edition-1-limited", 2],
      ["nft-005", "edition-5-limited", 1],
    ] as const)
      await post("/cart/items", { nftId, editionId, quantity });
    const walletId = "wallet-ada-primary";
    await post("/wallet-connections", { walletId });
    const cart = (await fetch("/api/cart", { headers }).then(json)).data as {
      id: string;
      version: number;
    };
    const quote = (
      await post("/quotes", {
        cartId: cart.id,
        cartVersion: cart.version,
        walletId,
      })
    ).data as { id: string; version: number };
    const order = (
      await post(
        "/orders",
        {
          quoteId: quote.id,
          quoteVersion: quote.version,
          walletId,
          collector: {
            displayName: "Ada Example",
            username: "ada_example",
            email: "ada@example.test",
            profileName: "Ada Colecionadora",
          },
        },
        { "Idempotency-Key": "e2e-reference-order-0001" },
      )
    ).data as { id: string };
    return order.id;
  });
  // Past the simulated payment delay: the page timer confirms the order.
  await page.clock.setFixedTime(new Date("2026-07-29T12:00:05.000Z"));
  await page.goto(`/orders/${orderId}`);
  await expect(
    page.getByRole("heading", {
      name: "Seus NFTs agora estão na sua carteira",
    }),
  ).toBeVisible();
  await expect(page.locator(".order-facts")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(images.map((image) => image.decode()));
  });
  // A full-page capture draws the fixed mobile navigation over the middle of
  // the page; on a phone it stays at the bottom of the screen.
  await page.addStyleTag({
    content: ".mobile-nav { display: none !important; }",
  });
  await expect(page).toHaveScreenshot("recibo.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    // The simulated transaction hash is random; notices are transient.
    mask: [
      page.locator(".order-facts > div").first().locator("dd"),
      page.locator(".notices"),
    ],
  });
});
