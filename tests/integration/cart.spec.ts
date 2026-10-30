import { test, expect, type Page } from "@playwright/test";
import type { Harness } from "../../src/testing/harness";
declare global {
  interface Window {
    __KURIO_TEST__: Harness;
  }
}
type Line = [nftId: string, editionId: string, quantity: number];
// Seeds the visitor's cart through the real REST handlers, as a client would.
async function seed(page: Page, lines: Line[]) {
  await page.evaluate(async (lines) => {
    let token = localStorage.getItem("kurio.visitor.v1");
    if (!token) {
      const response = await fetch("/api/visitor-sessions", { method: "POST" });
      token = ((await response.json()) as { data: { token: string } }).data
        .token;
      localStorage.setItem("kurio.visitor.v1", token);
    }
    for (const [nftId, editionId, quantity] of lines) {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Visitor-Token": token,
        },
        body: JSON.stringify({ nftId, editionId, quantity }),
      });
      if (!response.ok) throw new Error(await response.text());
    }
  }, lines);
}
const row = (page: Page, name: string) =>
  page.locator(".cart-table tbody tr").filter({ hasText: name });
const amount = (page: Page, label: string) =>
  page.locator(".amounts > div").filter({ hasText: label }).locator("dd");
const total = (page: Page) => page.locator(".amount-total dd");
async function openCart(page: Page) {
  await page.goto("/cart");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
});
const buy = (page: Page) =>
  page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
test("Comprar no detalhe adiciona ao carrinho, atualiza o badge e leva ao carrinho", async ({
  page,
}) => {
  await expect(
    page.getByRole("link", { name: "Carrinho, vazio" }),
  ).toBeVisible();
  await expect(page.locator(".cart-badge:visible")).toHaveCount(0);
  await page.goto("/nfts/nft-001");
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await buy(page);
  await expect(page).toHaveURL(/\/cart$/);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Carrinho, 2 itens" }).first(),
  ).toBeAttached();
  await openCart(page);
  await expect(row(page, "Emerald Ape #042")).toContainText("2.38 ETH");
  await expect(row(page, "Emerald Ape #042").locator(".qty-value")).toHaveText(
    "2",
  );
  await page.goto("/nfts/nft-002");
  await page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(row(page, "Sage Nomad #043")).toBeVisible();
  await expect(page.locator(".cart-table tbody tr")).toHaveCount(2);
});
test("badge soma quantidades e exibe 99+ acima de 99", async ({ page }) => {
  await seed(page, [
    ["nft-001", "edition-1-limited", 1],
    ...Array.from({ length: 11 }, (_, i): Line[] => [
      [`nft-${String(i + 2).padStart(3, "0")}`, `edition-${i + 2}-limited`, 5],
      [`nft-${String(i + 2).padStart(3, "0")}`, `edition-${i + 2}-unique`, 1],
      [`nft-${String(i + 2).padStart(3, "0")}`, `edition-${i + 2}-open`, 3],
    ]).flat(),
  ]);
  await page.reload();
  const link = page.getByRole("link", { name: "Carrinho, 100 itens" });
  await expect(link).toBeVisible();
  await expect(link.locator(".cart-badge")).toHaveText("99+");
});
test("mesma edição soma à linha e exceder o limite não altera o carrinho", async ({
  page,
}) => {
  await page.goto("/nfts/nft-001");
  await page.getByRole("spinbutton", { name: "Qtd." }).fill("3");
  await buy(page);
  await expect(page).toHaveURL(/\/cart$/);
  await page.goto("/nfts/nft-001");
  await page.getByRole("spinbutton", { name: "Qtd." }).fill("3");
  await buy(page);
  // Refused: the explanation stays on the detail page.
  await expect(page.locator("#cart-feedback")).toContainText(
    "Você já tem 3 no carrinho e o limite atual é 5. É possível adicionar no máximo 2.",
  );
  await expect(page).toHaveURL(/\/nfts\/nft-001$/);
  await page.getByRole("spinbutton", { name: "Qtd." }).fill("2");
  await buy(page);
  await expect(page).toHaveURL(/\/cart$/);
  await openCart(page);
  await expect(page.locator(".cart-table tbody tr")).toHaveCount(1);
  await expect(row(page, "Emerald Ape #042").locator(".qty-value")).toHaveText(
    "5",
  );
});
test("quantidades respeitam limites, remover chega ao estado vazio e refresh preserva", async ({
  page,
}) => {
  await seed(page, [
    ["nft-001", "edition-1-limited", 2],
    ["nft-003", "edition-3-limited", 1],
  ]);
  await openCart(page);
  await page.reload();
  const emerald = row(page, "Emerald Ape #042");
  const decrease = emerald.getByRole("button", { name: /Diminuir quantidade/ });
  const increase = emerald.getByRole("button", { name: /Aumentar quantidade/ });
  await decrease.click();
  await expect(emerald.locator(".qty-value")).toHaveText("1");
  await expect(decrease).toHaveAttribute("aria-disabled", "true");
  for (const expected of ["2", "3", "4", "5"]) {
    await increase.click();
    await expect(emerald.locator(".qty-value")).toHaveText(expected);
  }
  await expect(increase).toHaveAttribute("aria-disabled", "true");
  // aria-disabled keeps focus but is not actionable for Playwright; dispatch
  // the click directly to prove it does nothing at the limit.
  await increase.dispatchEvent("click");
  await expect(emerald.locator(".qty-value")).toHaveText("5");
  await expect(emerald.locator(".cart-line-total")).toHaveText("5.95 ETH");
  await expect(amount(page, "Subtotal")).toHaveText("8.95 ETH");
  await expect(total(page)).toHaveText("8.966 ETH");
  await page.reload();
  await expect(emerald.locator(".qty-value")).toHaveText("5");
  await emerald.getByRole("button", { name: /^Remover/ }).click();
  await expect(
    page.getByRole("link", { name: "Noon Verbal #044" }),
  ).toBeFocused();
  await row(page, "Noon Verbal #044")
    .getByRole("button", { name: /^Remover/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeFocused();
  await expect(page.getByRole("link", { name: "Explorar NFTs" })).toBeVisible();
});
test("cupons: válido, fixo maior que o subtotal, inexistente, expirado, troca e remoção", async ({
  page,
}) => {
  await seed(page, [["nft-001", "edition-1-limited", 2]]);
  await openCart(page);
  const input = page.getByRole("textbox", { name: "Código promocional" });
  const apply = page.getByRole("button", { name: "Aplicar", exact: true });
  await input.fill("nao-existe");
  await apply.click();
  await expect(page.locator("#coupon-error")).toHaveText(
    "Este código promocional não existe.",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("kurio15");
  await apply.click();
  await expect(page.locator("#coupon-error")).toHaveText(
    "Este código promocional expirou.",
  );
  await input.fill("KURIO10");
  await apply.click();
  await expect(page.locator("#coupon-applied")).toContainText("KURIO10");
  await expect(amount(page, "Desconto")).toHaveText("(-) 0.238 ETH");
  await expect(total(page)).toHaveText("2.158 ETH");
  await input.fill("LANCAMENTO");
  await apply.click();
  await expect(page.locator("#coupon-applied")).toContainText("LANCAMENTO");
  await expect(amount(page, "Desconto")).toHaveText("(-) 0.10 ETH");
  await expect(total(page)).toHaveText("2.296 ETH");
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "0.04",
    }),
  );
  await expect(amount(page, "Subtotal")).toHaveText("0.08 ETH");
  await expect(amount(page, "Desconto")).toHaveText("(-) 0.08 ETH");
  await expect(total(page)).toHaveText("0.016 ETH");
  await page.getByRole("button", { name: "Remover cupom" }).click();
  await expect(amount(page, "Desconto")).toHaveText("0.00 ETH");
  await expect(page.locator("#coupon-applied")).toHaveCount(0);
});
test("valores preservam precisão decimal sem ponto flutuante", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    await h.update("nft-001", "edition-1-limited", { priceEth: "0.1" });
    await h.update("nft-003", "edition-3-limited", { priceEth: "0.2" });
    await h.update("nft-005", "edition-5-limited", {
      priceEth: "1.000000000000000001",
    });
  });
  await seed(page, [
    ["nft-001", "edition-1-limited", 1],
    ["nft-003", "edition-3-limited", 1],
  ]);
  await openCart(page);
  await expect(amount(page, "Subtotal")).toHaveText("0.30 ETH");
  await expect(total(page)).toHaveText("0.316 ETH");
  await seed(page, [["nft-005", "edition-5-limited", 3]]);
  await page.reload();
  await expect(
    row(page, "Violet Nomad #046").locator(".cart-line-total"),
  ).toHaveText("3.000000000000000003 ETH");
  await expect(amount(page, "Subtotal")).toHaveText("3.300000000000000003 ETH");
  await expect(total(page)).toHaveText("3.316000000000000003 ETH");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("nft.updated altera preço e disponibilidade; conflito bloqueia; eventos antigos não regridem", async ({
  page,
}) => {
  await seed(page, [["nft-001", "edition-1-limited", 2]]);
  await openCart(page);
  const emerald = row(page, "Emerald Ape #042");
  await expect(emerald.locator(".cart-line-total")).toHaveText("2.38 ETH");
  const update = (patch: { priceEth?: string; available?: number }) =>
    page.evaluate(
      (patch) =>
        window.__KURIO_TEST__.update("nft-001", "edition-1-limited", patch),
      patch,
    );
  await update({ priceEth: "1.5" });
  await expect(emerald.locator(".cart-line-total")).toHaveText("3.00 ETH");
  await expect(emerald.locator(".cart-notice")).toContainText(
    "Preço alterado de 1.19 ETH para 1.50 ETH.",
  );
  await expect(page.locator("#cart-announcer")).toContainText(
    "Preço de Emerald Ape #042 (1/20) mudou para 1.50 ETH.",
  );
  await emerald.getByRole("button", { name: "Ciente do novo preço" }).click();
  await expect(emerald.locator(".cart-notice")).toHaveCount(0);
  await update({ available: 1 });
  await expect(emerald.locator(".cart-notice")).toContainText(
    "Disponível no máximo 1.",
  );
  const checkout = page.getByRole("button", { name: "Conectar e finalizar" });
  await expect(checkout).toBeDisabled();
  await expect(page.locator("#checkout-blocked")).toBeVisible();
  await emerald.getByRole("button", { name: "Ajustar para 1" }).click();
  await expect(emerald.locator(".qty-value")).toHaveText("1");
  // Without conflicts and signed out, checkout becomes the way to the login.
  await expect(checkout).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Conectar e finalizar" }),
  ).toBeVisible();
  await update({ available: 0 });
  await expect(emerald.locator(".cart-notice")).toContainText(
    "Esta edição esgotou.",
  );
  await expect(checkout).toBeDisabled();
  const ignored = await page.evaluate(
    () => window.__KURIO_TEST__.liveStats()!.ignored,
  );
  await page.evaluate(() => {
    window.__KURIO_TEST__.duplicate();
    window.__KURIO_TEST__.older();
  });
  // Both reached the page's Socket.IO client and were ignored.
  await page.waitForFunction(
    (ignored) => window.__KURIO_TEST__.liveStats()!.ignored >= ignored + 2,
    ignored,
  );
  await expect(emerald.locator(".cart-notice")).toContainText(
    "Esta edição esgotou.",
  );
  await expect(checkout).toBeDisabled();
});
test("reconexão reconcilia o carrinho por REST", async ({ page }) => {
  await seed(page, [["nft-001", "edition-1-limited", 2]]);
  await openCart(page);
  const emerald = row(page, "Emerald Ape #042");
  await expect(emerald.locator(".cart-line-total")).toHaveText("2.38 ETH");
  await page.evaluate(() => window.__KURIO_TEST__.interrupt());
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "7",
    }),
  );
  // The update is persisted and its event emitted to no connection: nothing
  // can reach the page until it reconnects.
  await expect(emerald.locator(".cart-line-total")).toHaveText("2.38 ETH");
  await page.evaluate(() => window.__KURIO_TEST__.restore());
  await expect(emerald.locator(".cart-line-total")).toHaveText("14.00 ETH");
});
test("falhas preservam o estado, permitem nova tentativa e o skeleton aparece em resposta lenta", async ({
  page,
}) => {
  await seed(page, [["nft-001", "edition-1-limited", 2]]);
  await openCart(page);
  const emerald = row(page, "Emerald Ape #042");
  const increase = emerald.getByRole("button", { name: /Aumentar quantidade/ });
  await page.evaluate(() =>
    window.__KURIO_TEST__.failNextCart("http", "write"),
  );
  await increase.click();
  await expect(emerald.getByRole("alert")).toHaveText(
    "Serviço temporariamente indisponível. Tente novamente.",
  );
  await expect(emerald.locator(".qty-value")).toHaveText("2");
  await increase.click();
  await expect(emerald.locator(".qty-value")).toHaveText("3");
  await expect(emerald.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() =>
    window.__KURIO_TEST__.failNextCart("network", "write"),
  );
  await increase.click();
  await expect(emerald.getByRole("alert")).toContainText("Falha de conexão");
  await expect(emerald.locator(".qty-value")).toHaveText("3");
  await page.goto("/");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
  // Let the header finish its own cart load before arming one-shot controls.
  await expect(
    page.getByRole("link", { name: "Carrinho, 3 itens" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__KURIO_TEST__.cartDelay("read", 1500);
    window.__KURIO_TEST__.forgetCart();
  });
  await page.getByRole("link", { name: /^Carrinho/ }).click();
  await expect(
    page.getByRole("status", { name: "Carregando carrinho" }),
  ).toBeVisible();
  await expect(emerald.locator(".qty-value")).toHaveText("3");
  await page.goto("/");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
  await expect(
    page.getByRole("link", { name: "Carrinho, 3 itens" }),
  ).toBeVisible();
  // A persistent failure scenario (instead of a one-shot failure) makes every
  // cart read fail until it is switched off, so no fetch timing can let the
  // page load succeed before the error screen is observed.
  await page.evaluate(() => {
    window.__KURIO_TEST__.scenario("http-error");
    window.__KURIO_TEST__.forgetCart();
  });
  await page.getByRole("link", { name: /^Carrinho/ }).click();
  await expect(
    page.getByRole("heading", { name: "Não foi possível carregar o carrinho" }),
  ).toBeVisible();
  await page.evaluate(() => window.__KURIO_TEST__.scenario("default"));
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(emerald.locator(".qty-value")).toHaveText("3");
});
test("teclado mantém o foco e Conectar e finalizar leva ao login", async ({
  page,
}) => {
  await seed(page, [
    ["nft-001", "edition-1-limited", 2],
    ["nft-003", "edition-3-limited", 1],
  ]);
  await openCart(page);
  const emerald = row(page, "Emerald Ape #042");
  const increase = emerald.getByRole("button", { name: /Aumentar quantidade/ });
  await increase.focus();
  for (const expected of ["3", "4", "5"]) {
    await page.keyboard.press("Enter");
    await expect(emerald.locator(".qty-value")).toHaveText(expected);
    await expect(increase).toBeFocused();
  }
  await expect(increase).toHaveAttribute("aria-disabled", "true");
  await emerald.getByRole("button", { name: /^Remover/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Noon Verbal #044" }),
  ).toBeFocused();
  // Signed out, checkout opens the login over the cart, continuing to the
  // checkout; Escape closes it back to the cart.
  const checkout = page.getByRole("link", { name: "Conectar e finalizar" });
  await checkout.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/);
  await expect(page.getByRole("textbox", { name: "E-mail" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("um novo contexto do navegador começa com carrinho vazio", async ({
  page,
  browser,
}, testInfo) => {
  await seed(page, [["nft-001", "edition-1-limited", 1]]);
  await openCart(page);
  await expect(page.locator(".cart-table tbody tr")).toHaveCount(1);
  const other = await browser.newContext({
    ...testInfo.project.use,
    baseURL: testInfo.project.use.baseURL,
  });
  const fresh = await other.newPage();
  await fresh.goto("/cart");
  await expect(
    fresh.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  await other.close();
});
test("leitura antiga do carrinho nunca sobrescreve uma alteração mais nova", async ({
  page,
}) => {
  await seed(page, [["nft-001", "edition-1-limited", 2]]);
  await openCart(page);
  const emerald = row(page, "Emerald Ape #042");
  await expect(emerald.locator(".qty-value")).toHaveText("2");
  // Record every quantity the page shows, to detect any regression.
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { __qty: seen });
    const target = document.querySelector(".cart-table tbody")!;
    new MutationObserver(() => {
      const value = document.querySelector(".qty-value")?.textContent ?? "";
      if (seen.at(-1) !== value) seen.push(value);
    }).observe(target, { subtree: true, childList: true, characterData: true });
  });
  // The PATCH waits 300ms before writing; the GET triggered by the event reads
  // the state immediately (before the write) and answers only after 900ms.
  const updatesBefore = await page.evaluate(
    () => window.__KURIO_TEST__.cartQuery().dataUpdateCount,
  );
  await page.evaluate(() => {
    window.__KURIO_TEST__.cartDelay("write", 300);
    window.__KURIO_TEST__.cartDelay("read", 900);
  });
  await emerald.getByRole("button", { name: /Aumentar quantidade/ }).click();
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      available: 9,
    }),
  );
  await expect(emerald.locator(".qty-value")).toHaveText("3");
  // Observed condition instead of a fixed wait: both the PATCH result and the
  // delayed GET reached the cart query, and nothing is still fetching.
  await page.waitForFunction((before) => {
    const query = window.__KURIO_TEST__.cartQuery();
    return query.dataUpdateCount >= before + 2 && query.fetchStatus === "idle";
  }, updatesBefore);
  await expect(emerald.locator(".qty-value")).toHaveText("3");
  const seen = await page.evaluate(
    () => (window as unknown as { __qty: string[] }).__qty,
  );
  expect(seen.slice(seen.indexOf("3"))).not.toContain("2");
  await page.evaluate(() => window.__KURIO_TEST__.cartDelay("read", 0));
  await page.reload();
  await expect(emerald.locator(".qty-value")).toHaveText("3");
});
test("conflitos 409 trazem mensagens legíveis em fields.quantity", async ({
  page,
}) => {
  await seed(page, [
    ["nft-001", "edition-1-limited", 5],
    ["nft-003", "edition-3-limited", 3],
  ]);
  const responses = await page.evaluate(async () => {
    const token = localStorage.getItem("kurio.visitor.v1")!;
    const headers = {
      "content-type": "application/json",
      "X-Visitor-Token": token,
    };
    const add = await fetch("/api/cart/items", {
      method: "POST",
      headers,
      body: JSON.stringify({
        nftId: "nft-001",
        editionId: "edition-1-limited",
        quantity: 1,
      }),
    });
    const partial = await fetch("/api/cart/items", {
      method: "POST",
      headers,
      body: JSON.stringify({
        nftId: "nft-003",
        editionId: "edition-3-limited",
        quantity: 3,
      }),
    });
    const cart = await (await fetch("/api/cart", { headers })).json();
    const change = await fetch(`/api/cart/items/${cart.data.items[0].id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ quantity: 9 }),
    });
    return [
      { status: add.status, body: await add.json() },
      { status: partial.status, body: await partial.json() },
      { status: change.status, body: await change.json() },
    ];
  });
  // Limit already reached: dedicated message, no "no máximo 0".
  expect(responses[0].status).toBe(409);
  expect(responses[0].body.error.fields.quantity).toBe(
    "Você já atingiu o limite desta edição no carrinho.",
  );
  expect(responses[0].body.error.message).toBe(
    "Você já tem 5 no carrinho e o limite atual é 5. Não é possível adicionar mais unidades desta edição.",
  );
  // Some quantity still possible: current messages are kept.
  expect(responses[1].status).toBe(409);
  expect(responses[1].body.error.fields.quantity).toBe(
    "É possível adicionar no máximo 2.",
  );
  expect(responses[1].body.error.message).toBe(
    "Você já tem 3 no carrinho e o limite atual é 5. É possível adicionar no máximo 2.",
  );
  expect(responses[2].status).toBe(409);
  expect(responses[2].body.error.fields.quantity).toBe(
    "A quantidade máxima atual é 5.",
  );
});
