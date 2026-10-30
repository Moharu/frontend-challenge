import { test as base, expect, type Page } from "@playwright/test";
// Smoke tests of a published build, through public behavior only (no test
// bridge, no scenario controls). Each test has a fresh browser context, so
// the simulated state starts from the seed.
const remote = !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(
  process.env.DEPLOY_URL ?? "",
);
// The platform's headers and rewrites (vercel.json) exist only on Vercel;
// `vite preview` serves its own SPA fallback without them.
const onlyRemote = () =>
  test.skip(!remote, "vercel.json (headers and rewrites) só vale na Vercel");
// Fictional credentials documented in the README.
const ada = { email: "ada@example.test", password: "AdaKurio2026" };
// Every test fails on a console error or an /api request that left the
// browser (not answered by the service worker).
const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error")
          problems.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`page: ${error.message}`));
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith("/api/") && !response.fromServiceWorker())
          problems.push(`api outside the worker: ${response.url()}`);
      });
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});
const isMobile = (name: string) => name.includes("mobile");
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
async function appReady(page: Page) {
  await expect(page.locator("#main")).toBeVisible();
}
async function login(page: Page, target: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
  const form = page.getByRole("dialog");
  await expect(form.getByRole("textbox", { name: "E-mail" })).toBeFocused();
  await form.getByRole("textbox", { name: "E-mail" }).fill(ada.email);
  await form.getByLabel("Senha", { exact: true }).fill(ada.password);
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("1. acesso direto e refresh nas rotas; privadas levam ao login e voltam", async ({
  page,
}) => {
  for (const [path, check] of [
    [
      "/",
      () => expect(page.locator(".nft-grid .nft-card").first()).toBeVisible(),
    ],
    [
      "/nfts/nft-001",
      () => expect(heading(page)).toHaveText("Emerald Ape #042"),
    ],
    ["/cart", () => expect(page.locator("#main")).toContainText("Carrinho")],
    [
      "/login",
      () =>
        expect(
          page.getByRole("dialog").getByRole("textbox", { name: "E-mail" }),
        ).toBeVisible(),
    ],
    [
      "/signup",
      () =>
        expect(
          page.getByRole("dialog").getByRole("textbox", { name: "E-mail" }),
        ).toBeVisible(),
    ],
    [
      "/rota-que-nao-existe",
      () => expect(heading(page)).toHaveText("Página não encontrada"),
    ],
    // Test-only routes do not exist in the published build.
    [
      "/__private",
      () => expect(heading(page)).toHaveText("Página não encontrada"),
    ],
    [
      "/__protocol",
      () => expect(heading(page)).toHaveText("Página não encontrada"),
    ],
  ] as const) {
    await page.goto(path);
    await check();
    await page.reload();
    await check();
  }
  expect(await page.evaluate(() => "__KURIO_TEST__" in window)).toBe(false);
  // Private routes: the login, then back.
  for (const path of ["/checkout", "/account/wallets", "/orders/order-1"]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp(
        `/login\\?redirect=${encodeURIComponent(path).replace(/[.?]/g, "\\$&")}`,
      ),
    );
  }
  await page.goto("/account/wallets");
  const form = page.getByRole("dialog");
  await form.getByRole("textbox", { name: "E-mail" }).fill(ada.email);
  await form.getByLabel("Senha", { exact: true }).fill(ada.password);
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/wallets$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Carteira principal" }),
  ).toBeVisible();
});
test("2. arquivos estáticos: worker, assets, fontes, robots", async ({
  page,
  request,
}) => {
  const worker = await request.get("/mockServiceWorker.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toMatch(/javascript/);
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  await page.goto("/");
  await appReady(page);
  // A hashed bundle and a font, as referenced by the page.
  const script = await page
    .locator('script[type="module"][src^="/assets/"]')
    .first()
    .getAttribute("src");
  expect(script).toBeTruthy();
  const bundle = await request.get(script!);
  expect(bundle.status()).toBe(200);
  const font = await page.evaluate(
    () =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => /\.woff2?$/.test(n)) ?? null,
  );
  expect(font).toBeTruthy();
  expect((await request.get(font!)).status()).toBe(200);
  // An artwork the page loaded (names depend on the responsive sizes).
  const image = await page.evaluate(
    () =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => n.includes("/assets/art/")) ?? null,
  );
  expect(image).toBeTruthy();
  expect((await request.get(image!)).status()).toBe(200);
});
test("2b. cabeçalhos e /api sem index.html (Vercel)", async ({
  page,
  request,
}) => {
  onlyRemote();
  const worker = await request.get("/mockServiceWorker.js");
  expect(worker.headers()["cache-control"]).toMatch(/no-cache/);
  expect(worker.headers()["x-content-type-options"]).toBe("nosniff");
  const index = await request.get("/nfts/nft-001");
  expect(index.headers()["cache-control"]).toMatch(/no-cache/);
  expect(index.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  await page.goto("/");
  await appReady(page);
  const script = await page
    .locator('script[type="module"][src^="/assets/"]')
    .first()
    .getAttribute("src");
  expect((await request.get(script!)).headers()["cache-control"]).toMatch(
    /max-age=31536000.*immutable/,
  );
  // Outside the browser (no service worker), the API is not the SPA.
  const api = await request.get("/api/qualquer");
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"] ?? "").not.toMatch(/text\/html/);
  expect(await api.text()).not.toContain('<div id="root">');
});
test("3 e 4. compra completa: login, carrinho, checkout e recibo pelo socket", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page, "/nfts/nft-001");
  await expect(page).toHaveURL(/\/nfts\/nft-001$/);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator("#cart-feedback")).toContainText(
    "adicionado ao carrinho",
  );
  await page.goto(`/checkout?step=${mobile ? "revisao" : "dados"}`);
  await expect(page.locator("#connection-status")).toContainText("conectada");
  await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page).toHaveURL(/\/orders\/order-\d+$/);
  // The page never polls: the confirmation arrives through the simulated
  // Socket.IO connection (order.updated).
  await expect(heading(page)).toHaveText(
    /Aguardando confirmação da rede|Seus NFTs agora estão na sua carteira/,
  );
  await expect(heading(page)).toHaveText(
    "Seus NFTs agora estão na sua carteira",
  );
  await expect(page.locator(".order-facts")).toContainText("ID da transação");
});
test("5. favoritar e ver na Lista de interesse", async ({ page }) => {
  await login(page, "/");
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Favoritar Emerald Ape #042" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remover Emerald Ape #042 dos favoritos",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/account/favorites");
  await expect(page.locator(".account-favorites .nft-card")).toContainText(
    "Emerald Ape #042",
  );
});
