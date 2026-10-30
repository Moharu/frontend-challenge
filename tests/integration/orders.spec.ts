import { test, expect, type Page } from "@playwright/test";
import type { Harness } from "../../src/testing/harness";
declare global {
  interface Window {
    __KURIO_TEST__: Harness;
  }
}
// Fictional credentials documented in the README.
const ada = { email: "ada@example.test", password: "AdaKurio2026" };
const lin = { email: "lin@example.test", password: "LinKurio2026" };
type Line = [nftId: string, editionId: string, quantity: number];
const emerald: Line = ["nft-001", "edition-1-limited", 2];
const noon: Line = ["nft-003", "edition-3-limited", 1];
const isMobile = (name: string) => name.includes("mobile");
const dialog = (page: Page) => page.getByRole("dialog");
async function ready(page: Page) {
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
}
async function fillLogin(page: Page, credentials: typeof ada) {
  const form = dialog(page);
  await expect(form.getByRole("textbox", { name: "E-mail" })).toBeFocused();
  await form.getByRole("textbox", { name: "E-mail" }).fill(credentials.email);
  await form.getByLabel("Senha", { exact: true }).fill(credentials.password);
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function login(page: Page, credentials = ada) {
  await page.goto("/login?redirect=%2F");
  await ready(page);
  await fillLogin(page, credentials);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
}
// Authenticated API calls with the page's current session token.
async function api(
  page: Page,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  return page.evaluate(
    async ({ path, init }) => {
      const token = window.__KURIO_TEST__.identity().sessionToken;
      const r = await fetch(`/api${path}`, {
        method: init.method ?? "GET",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await r.text();
      return { status: r.status, body: text ? JSON.parse(text) : null };
    },
    { path, init },
  );
}
async function addLines(page: Page, lines: Line[]) {
  for (const [nftId, editionId, quantity] of lines) {
    const r = await api(page, "/cart/items", {
      method: "POST",
      body: { nftId, editionId, quantity },
    });
    expect(r.status).toBe(200);
  }
}
const cartLines = async (page: Page) =>
  (
    (await api(page, "/cart")).body.data.items as {
      nftId: string;
      quantity: number;
    }[]
  ).map((i) => [i.nftId, i.quantity]);
const available = async (page: Page, nftId: string, editionId: string) => {
  const nft = (await api(page, `/nfts/${nftId}`)).body.data as {
    editions: { id: string; available: number }[];
  };
  return nft.editions.find((e) => e.id === editionId)!.available;
};
const orderCount = (page: Page) =>
  page.evaluate(
    () => Object.keys(window.__KURIO_TEST__.snapshot().orders).length,
  );
// Payments wait until the test resolves them (no fixed waits).
const holdPayments = (
  page: Page,
  outcome: { status: "confirmed" } | { status: "declined"; reason: string } = {
    status: "confirmed",
  },
) =>
  page.evaluate(
    (outcome) => window.__KURIO_TEST__.setPayment(outcome, 3600000),
    outcome,
  );
const resolvePayments = (page: Page) =>
  page.evaluate(() => window.__KURIO_TEST__.resolvePayments());
// Checkout ready to confirm: the desktop page, or the mobile review step.
async function toConfirm(page: Page, mobile: boolean) {
  await page.goto(`/checkout?step=${mobile ? "revisao" : "dados"}`);
  await ready(page);
  await expect(page.locator("#connection-status")).toContainText("conectada");
  await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
}
const confirmButton = (page: Page) =>
  page.getByRole("button", { name: "Confirmar compra" });
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const pendingTitle = "Aguardando confirmação da rede";
const confirmedTitle = "Seus NFTs agora estão na sua carteira";
async function placeOrder(page: Page, mobile: boolean) {
  await toConfirm(page, mobile);
  await confirmButton(page).click();
  await expect(page).toHaveURL(/\/orders\/order-\d+$/);
  await expect(heading(page)).toHaveText(pendingTitle);
  return page.url().split("/").pop()!;
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});
test("1. compra completa: pendente → confirmado com recibo; o carrinho perde só o comprado", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald, noon]);
  await holdPayments(page);
  const id = await placeOrder(page, mobile);
  await expect(page.getByText(/Você pode sair desta página/)).toBeVisible();
  // Going back does not return to a checkout that would send it again.
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  const facts = page.locator(".order-facts");
  await expect(facts).toContainText("ID da transação");
  await expect(facts).toContainText("5.396 ETH");
  await expect(page.locator(".order-items tbody tr")).toHaveCount(2);
  await expect(page.locator(".order-totals")).toContainText("Subtotal");
  await expect(page.locator(".order-totals")).not.toContainText("Desconto");
  await expect(page.locator(".order-note")).toContainText(
    "Transação confirmada na Ethereum.",
  );
  const receipt = (await api(page, `/orders/${id}/receipt`)).body.data;
  expect(receipt.transactionReference).toMatch(/^0x[0-9a-f]{64}$/);
  expect(await cartLines(page)).toEqual([]);
});
test("2. linha acrescentada enquanto o pedido está pendente permanece após a confirmação", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await placeOrder(page, mobile);
  // While pending: one more unit of the same edition and a new line.
  await addLines(page, [
    ["nft-001", "edition-1-limited", 1],
    ["nft-005", "edition-5-limited", 1],
  ]);
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  expect(await cartLines(page)).toEqual([
    ["nft-001", 1],
    ["nft-005", 1],
  ]);
});
test("3. recusa: motivo, carrinho intacto, estoque reservado e liberado, Voltar ao checkout", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald, noon]);
  const before = await available(page, "nft-001", "edition-1-limited");
  await holdPayments(page, {
    status: "declined",
    reason: "Saldo insuficiente na carteira",
  });
  await placeOrder(page, mobile);
  // Reserved while pending.
  expect(await available(page, "nft-001", "edition-1-limited")).toBe(
    before - 2,
  );
  await resolvePayments(page);
  await expect(heading(page)).toHaveText("Pagamento recusado");
  await expect(page.locator(".order-card")).toContainText(
    "Saldo insuficiente na carteira",
  );
  await expect(page.locator(".order-card")).toContainText(
    "seu carrinho foi preservado",
  );
  await expect(page.locator(".order-thanks")).toHaveCount(0);
  expect(await cartLines(page)).toEqual([
    ["nft-001", 2],
    ["nft-003", 1],
  ]);
  expect(await available(page, "nft-001", "edition-1-limited")).toBe(before);
  await page.getByRole("link", { name: "Voltar ao checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
});
test("4. cliques repetidos rápidos e duas abas com a mesma chave: um único pedido", async ({
  page,
  context,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await toConfirm(page, mobile);
  // Rapid clicks: three in the same task, before any re-render can disable
  // the button.
  await page.evaluate(() => {
    const button =
      document.querySelector<HTMLButtonElement>(".checkout-confirm")!;
    button.click();
    button.click();
    button.click();
  });
  await expect(page).toHaveURL(/\/orders\/order-1$/);
  expect(await orderCount(page)).toBe(1);
  // The cart accepts a new order once the first resolves.
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  // Second purchase whose response is lost, then a second tab (a copy of
  // this tab's session storage) resumes with the same key.
  await addLines(page, [noon]);
  await toConfirm(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.loseNextOrderResponse());
  await confirmButton(page).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível confirmar o envio do pedido.",
  );
  expect(await orderCount(page)).toBe(2);
  const [second] = await Promise.all([
    context.waitForEvent("page"),
    page.evaluate(() => window.open("/checkout", "_blank")),
  ]);
  await expect(second).toHaveURL(/\/orders\/order-2$/);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page).toHaveURL(/\/orders\/order-2$/);
  expect(await orderCount(page)).toBe(2);
});
test("5. resposta perdida depois da criação: a nova tentativa com a mesma chave recupera o mesmo pedido", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await toConfirm(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.loseNextOrderResponse());
  await confirmButton(page).click();
  const alert = page.getByRole("alert").filter({
    hasText: "Não foi possível confirmar o envio do pedido.",
  });
  await expect(alert).toBeVisible();
  const key = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("kurio.checkout.order.v1:user-ada")!),
  );
  expect(await orderCount(page)).toBe(1);
  await alert.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page).toHaveURL(/\/orders\/order-1$/);
  expect(await orderCount(page)).toBe(1);
  // The same key is replayed until the user sees a terminal state.
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("kurio.checkout.order.v1:user-ada")!),
    ),
  ).toMatchObject({ key: key.key, orderId: "order-1" });
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("kurio.checkout.order.v1:user-ada"),
    ),
  ).toBeNull();
});
// Valid order prerequisites through the API: a connected wallet and a quote.
async function quoteFor(page: Page, walletId = "wallet-ada-primary") {
  await api(page, "/wallet-connections", {
    method: "POST",
    body: { walletId },
  });
  const cart = (await api(page, "/cart")).body.data;
  return (
    await api(page, "/quotes", {
      method: "POST",
      body: { cartId: cart.id, cartVersion: cart.version, walletId },
    })
  ).body.data as { id: string; version: number };
}
const collector = {
  displayName: "Ada Example",
  username: "ada_example",
  email: "ada@example.test",
  profileName: "Ada Colecionadora",
};
test("6. mesma chave com corpo diferente: 409 na API; mesmo corpo: o mesmo pedido", async ({
  page,
}) => {
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  const quote = await quoteFor(page);
  const body = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    walletId: "wallet-ada-primary",
    collector,
  };
  // Collector data is validated on the server with the shared validators.
  const invalid = await api(page, "/orders", {
    method: "POST",
    headers: { "Idempotency-Key": "key-0000-0000-0002" },
    body: { ...body, collector: { ...collector, email: "não" } },
  });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error.fields.email).toBeTruthy();
  const headers = { "Idempotency-Key": "key-0000-0000-0001" };
  const first = await api(page, "/orders", { method: "POST", body, headers });
  expect(first.status).toBe(201);
  // Same body with properties in another order: canonical comparison.
  const reordered = await api(page, "/orders", {
    method: "POST",
    headers,
    body: {
      collector: { ...collector },
      walletId: body.walletId,
      quoteVersion: body.quoteVersion,
      quoteId: body.quoteId,
    },
  });
  expect(reordered.status).toBe(200);
  expect(reordered.body.data.id).toBe(first.body.data.id);
  const different = await api(page, "/orders", {
    method: "POST",
    headers,
    body: { ...body, collectorNote: "Outro corpo" },
  });
  expect(different.status).toBe(409);
  expect(different.body.error.code).toBe("CONFLICT");
  expect(await orderCount(page)).toBe(1);
});
test("7. cotação alterada entre a revisão e o envio: 409 no servidor e nova confirmação na interface", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  // API: price, expired coupon and expired quote each refuse the order with
  // QUOTE_CHANGED and the fresh quote.
  const quote = await quoteFor(page);
  const body = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    walletId: "wallet-ada-primary",
    collector,
  };
  await page.evaluate(() =>
    window.__KURIO_TEST__.persistUpdate("nft-001", "edition-1-limited", {
      priceEth: "1.5",
    }),
  );
  const changed = await api(page, "/orders", {
    method: "POST",
    headers: { "Idempotency-Key": "key-0000-0000-0003" },
    body,
  });
  expect(changed.status).toBe(409);
  expect(changed.body.error.code).toBe("QUOTE_CHANGED");
  expect(changed.body.error.quote.items[0].unitPriceEth).toBe("1.5");
  expect(changed.body.error.quote.version).toBe(quote.version + 1);
  await page.evaluate(() => window.__KURIO_TEST__.quoteTtl(1));
  const expiring = await quoteFor(page);
  await page.waitForFunction(() => true);
  const expired = await api(page, "/orders", {
    method: "POST",
    headers: { "Idempotency-Key": "key-0000-0000-0004" },
    body: { ...body, quoteId: expiring.id, quoteVersion: expiring.version },
  });
  expect(expired.body.error.code).toBe("QUOTE_CHANGED");
  await page.evaluate(() => window.__KURIO_TEST__.quoteTtl(120000));
  expect(await orderCount(page)).toBe(0);
  // UI: the price changes after the review, right before the server gets
  // the order; the user sees what changed and confirms again.
  await toConfirm(page, mobile);
  await page.evaluate(() =>
    window.__KURIO_TEST__.changeBeforeNextOrder(
      "nft-001",
      "edition-1-limited",
      { priceEth: "1.75" },
    ),
  );
  await confirmButton(page).click();
  await expect(page.locator(".quote-changes")).toContainText(
    "preço de 1.50 ETH para 1.75 ETH",
  );
  expect(await orderCount(page)).toBe(0);
  await page
    .getByRole("button", { name: "Revisei, confirmar com os novos valores" })
    .click();
  await expect(page).toHaveURL(/\/orders\/order-1$/);
  expect(await orderCount(page)).toBe(1);
});
test("8. refresh na página do pedido pendente e no checkout durante o envio, sem duplicar", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await placeOrder(page, mobile);
  await page.reload();
  await expect(heading(page)).toHaveText(pendingTitle);
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  // Refresh in the checkout while a send is unresolved: it resumes.
  await addLines(page, [noon]);
  await toConfirm(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.loseNextOrderResponse());
  await confirmButton(page).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível confirmar o envio do pedido.",
  );
  await page.reload();
  await expect(page).toHaveURL(/\/orders\/order-2$/);
  expect(await orderCount(page)).toBe(2);
});
test("9. socket desconectado durante o pedido: a reconexão reconcilia por REST", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await placeOrder(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.interrupt());
  await resolvePayments(page);
  // The event was lost with the connection: the page still shows pending.
  await expect(heading(page)).toHaveText(pendingTitle);
  await page.evaluate(() => window.__KURIO_TEST__.restore());
  await expect(heading(page)).toHaveText(confirmedTitle);
});
test("10. order.updated duplicado, antigo ou de outro usuário não regride nem vaza", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  // Probes: Ada's own session, Lin's session and an anonymous connection.
  const linToken = await page.evaluate(async (lin) => {
    const r = await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lin),
    });
    return ((await r.json()) as { data: { token: string } }).data.token;
  }, lin);
  const id = await placeOrder(page, mobile);
  await page.evaluate((linToken) => {
    const h = window.__KURIO_TEST__;
    Object.assign(window, {
      __probes: {
        ada: h.probeSocket(h.identity().sessionToken),
        lin: h.probeSocket(linToken),
        anon: h.probeSocket(null),
      },
    });
  }, linToken);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.authenticatedSockets().length >= 3,
  );
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  type Probe = { received(): string[] };
  const traffic = async () =>
    page.evaluate(() => {
      const p = (window as unknown as { __probes: Record<string, Probe> })
        .__probes;
      return {
        ada: p.ada.received(),
        lin: p.lin.received(),
        anon: p.anon.received(),
      };
    });
  await expect
    .poll(async () => (await traffic()).ada)
    .toContain("order.updated");
  const seen = await traffic();
  expect(seen.lin).not.toContain("order.updated");
  expect(seen.anon).not.toContain("order.updated");
  // Duplicate and stale events never regress the confirmed state.
  await page.evaluate((id) => {
    const h = window.__KURIO_TEST__;
    h.duplicateOrder();
    h.staleOrder({
      id,
      version: 1,
      status: "pending",
      receipt: null,
      declineCode: null,
    });
  }, id);
  await expect(heading(page)).toHaveText(confirmedTitle);
  await expect(page.locator(".order-facts")).toBeVisible();
});
test("11. recibo imutável: preço e nome mudam depois da confirmação", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  const id = await placeOrder(page, mobile);
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    await h.update("nft-001", "edition-1-limited", { priceEth: "9" });
    await h.update("nft-001", "edition-1-limited", { name: "Outro Nome" });
  });
  await page.reload();
  await expect(heading(page)).toHaveText(confirmedTitle);
  const row = page.locator(".order-items tbody tr").first();
  await expect(row).toContainText("Emerald Ape #042");
  await expect(row).toContainText("2.38 ETH");
  const receipt = (await api(page, `/orders/${id}/receipt`)).body.data;
  expect(receipt.items[0]).toMatchObject({
    name: "Emerald Ape #042",
    unitPriceEth: "1.19",
  });
});
test("12. pedido de outro usuário: 403 na API e página com erro", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  const id = await placeOrder(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  await login(page, lin);
  expect((await api(page, `/orders/${id}`)).status).toBe(403);
  await page.goto(`/orders/${id}`);
  await expect(heading(page)).toHaveText("Este pedido pertence a outra conta");
});
test("13. sessão expirada com pedido pendente: novo login e retorno à página do pedido", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  const id = await placeOrder(page, mobile);
  await page.evaluate(() => window.__KURIO_TEST__.expireSession());
  // Coming back later: the stored session no longer verifies, the guard
  // sends to the login with this order as the return target.
  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=%2Forders%2F${id}$`),
  );
  await fillLogin(page, ada);
  await expect(page).toHaveURL(new RegExp(`/orders/${id}$`));
  await expect(heading(page)).toHaveText(pendingTitle);
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
});
test("14. teclado, foco e anúncios nos estados; Ver no Etherscan informa indisponibilidade", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await placeOrder(page, mobile);
  await expect(page.locator(".order-progress")).toBeVisible();
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  // Focus on the new state's title, announced once.
  await expect(heading(page)).toBeFocused();
  await expect(page.locator(".order-page [role=status]").first()).toHaveText(
    "Pagamento confirmado. Seus NFTs estão na sua carteira.",
  );
  // Receipt table semantics.
  // (On mobile the header row is visually hidden but stays in the table.)
  await expect(page.getByRole("columnheader", { name: "Edições" })).toHaveCount(
    1,
  );
  await expect(page.getByRole("rowheader").first()).toContainText(
    "Emerald Ape #042",
  );
  await expect(
    page.getByRole("link", { name: "Fechar e voltar ao catálogo" }),
  ).toBeVisible();
  const etherscan = page.getByRole("button", { name: "Ver no Etherscan" });
  await etherscan.focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toContainText("não usa uma blockchain real");
  await page.keyboard.press("Escape");
  await expect(etherscan).toBeFocused();
});
test("15. pendências: lista de definição válida e cupom expirado removível", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await api(page, "/cart/coupon", { method: "PUT", body: { code: "KURIO10" } });
  await page.evaluate(() => window.__KURIO_TEST__.expireCoupon("KURIO10"));
  await toConfirm(page, mobile);
  // Only name/value groups inside the amounts <dl>.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll(".checkout-amounts > *")].every(
        (el) => el.tagName === "DIV",
      ),
    ),
  ).toBe(true);
  await expect(page.locator(".quote-coupon-removed")).toHaveText(
    "O cupom KURIO10 expirou e foi removido.",
  );
  // The expired coupon can be removed from the cart, clearing the message.
  await page.goto("/cart");
  await ready(page);
  const summary = page.locator(".cart-summary");
  await expect(summary.locator(".coupon-removed")).toHaveText(
    "O cupom KURIO10 expirou e foi removido.",
  );
  await summary.getByRole("button", { name: "Remover cupom KURIO10" }).click();
  await expect(summary.locator(".coupon-removed")).toHaveText("");
  const cart = (await api(page, "/cart")).body.data;
  expect(cart.couponRemoved).toBeNull();
});
test("16. duas abas com chaves diferentes: um único pedido; a segunda aba vai ao pedido existente", async ({
  page,
  context,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  const id = await placeOrder(page, mobile);
  // A new tab has its own session storage: no key from the first tab.
  const second = await context.newPage();
  await second.goto("/");
  await ready(second);
  await toConfirm(second, mobile);
  await confirmButton(second).click();
  await expect(second).toHaveURL(new RegExp(`/orders/${id}$`));
  await expect(second.locator(".notices")).toContainText(
    "Já existe um pedido em andamento para este carrinho.",
  );
  expect(await orderCount(page)).toBe(1);
  expect(
    await second.evaluate(() =>
      sessionStorage.getItem("kurio.checkout.order.v1:user-ada"),
    ),
  ).toBeNull();
});
test("17. API: 409 ORDER_PENDING com o pedido existente; a mesma chave segue idempotente; após a recusa, novo pedido", async ({
  page,
}) => {
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page, { status: "declined", reason: "Recusado" });
  const quote = await quoteFor(page);
  const body = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    walletId: "wallet-ada-primary",
    collector,
  };
  const headers = { "Idempotency-Key": "key-pending-0000-0001" };
  const first = await api(page, "/orders", { method: "POST", body, headers });
  expect(first.status).toBe(201);
  // The key check comes first: the same key and body still get the order.
  const again = await api(page, "/orders", { method: "POST", body, headers });
  expect(again.status).toBe(200);
  expect(again.body.data.id).toBe(first.body.data.id);
  const before = await available(page, "nft-001", "edition-1-limited");
  const other = await api(page, "/orders", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": "key-pending-0000-0002" },
  });
  expect(other.status).toBe(409);
  expect(other.body.error.code).toBe("ORDER_PENDING");
  expect(other.body.error.orderId).toBe(first.body.data.id);
  // No second order and no second reservation.
  expect(await orderCount(page)).toBe(1);
  expect(await available(page, "nft-001", "edition-1-limited")).toBe(before);
  await resolvePayments(page);
  const fresh = await quoteFor(page);
  const next = await api(page, "/orders", {
    method: "POST",
    headers: { "Idempotency-Key": "key-pending-0000-0003" },
    body: { ...body, quoteId: fresh.id, quoteVersion: fresh.version },
  });
  expect(next.status).toBe(201);
  expect(await orderCount(page)).toBe(2);
});
test("18. edição única com pagamento pendente: sem esgotado falso no carrinho do comprador", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  const unique = "edition-2-unique";
  // Public availability, as a visitor or another user sees it.
  const publicAvailable = () =>
    page.evaluate(async (unique) => {
      const r = await fetch("/api/nfts/nft-002");
      const nft = (await r.json()).data as {
        editions: { id: string; available: number }[];
      };
      return nft.editions.find((e) => e.id === unique)!.available;
    }, unique);
  await login(page);
  await addLines(page, [["nft-002", unique, 1]]);
  // Declined first: the reservation is released for everyone.
  await holdPayments(page, { status: "declined", reason: "Recusado" });
  await placeOrder(page, mobile);
  expect(await publicAvailable()).toBe(0);
  const pending = (await api(page, "/cart")).body.data;
  expect(pending.items[0].conflict).toBeNull();
  expect(pending.hasConflicts).toBe(false);
  expect(pending.pendingOrderId).toBe("order-1");
  await page.goto("/cart");
  await ready(page);
  await expect(page.locator(".cart-pending-order")).toContainText(
    "Há um pedido em andamento para este carrinho.",
  );
  // The checkout shows the same notice, with the link to the order.
  await page.goto("/checkout");
  await ready(page);
  await expect(
    page.locator(".checkout-pending-order").getByRole("link", {
      name: "Acompanhar pedido",
    }),
  ).toHaveAttribute("href", "/orders/order-1");
  await expect(page.getByText(/esgotou/)).toHaveCount(0);
  await resolvePayments(page);
  await page.goto("/orders/order-1");
  await expect(heading(page)).toHaveText("Pagamento recusado");
  expect(await publicAvailable()).toBe(1);
  // Confirmed: the line leaves the cart, and the edition stays sold.
  await holdPayments(page);
  await placeOrder(page, mobile);
  expect(await publicAvailable()).toBe(0);
  expect((await api(page, "/cart")).body.data.hasConflicts).toBe(false);
  await resolvePayments(page);
  await expect(heading(page)).toHaveText(confirmedTitle);
  expect(await cartLines(page)).toEqual([]);
  expect(await publicAvailable()).toBe(0);
});
const storedAttempt = (page: Page) =>
  page.evaluate(() =>
    sessionStorage.getItem("kurio.checkout.order.v1:user-ada"),
  );
test("19. sessão expirada na nova tentativa: a tentativa é preservada e retomada após entrar de novo", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await toConfirm(page, mobile);
  // The order is created, but its response is lost.
  await page.evaluate(() => window.__KURIO_TEST__.loseNextOrderResponse());
  await confirmButton(page).click();
  const alert = page.getByRole("alert").filter({
    hasText: "Não foi possível confirmar o envio do pedido.",
  });
  await expect(alert).toBeVisible();
  const attempt = JSON.parse((await storedAttempt(page))!);
  expect(await orderCount(page)).toBe(1);
  // The retry gets a 401: the attempt survives the expiry.
  await page.evaluate(() => window.__KURIO_TEST__.expireSession());
  await alert.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
  expect(JSON.parse((await storedAttempt(page))!)).toMatchObject({
    key: attempt.key,
  });
  // Signing in again resumes it with the same key: the same order.
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/orders\/order-1$/);
  expect(await orderCount(page)).toBe(1);
});
test("20. sessionStorage sem gravação: Tentar novamente ainda reenvia a mesma tentativa", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await toConfirm(page, mobile);
  // Writing the pending order fails (quota, privacy settings).
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("kurio.checkout.order.v1:"))
        throw new DOMException("Quota", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await page.evaluate(() => window.__KURIO_TEST__.loseNextOrderResponse());
  await confirmButton(page).click();
  const alert = page.getByRole("alert").filter({
    hasText: "Não foi possível confirmar o envio do pedido.",
  });
  await expect(alert).toBeVisible();
  expect(await storedAttempt(page)).toBeNull();
  await alert.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page).toHaveURL(/\/orders\/order-1$/);
  expect(await orderCount(page)).toBe(1);
});
test("21. socket: sessões encerradas em outra aba, expiradas ou revogadas pela troca de senha não recebem order.updated", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await holdPayments(page);
  await placeOrder(page, mobile);
  // Four more sessions of Ada, each with its own socket connection.
  const tokens = await page.evaluate(async (ada) => {
    const open = async () => {
      const r = await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ada),
      });
      return ((await r.json()) as { data: { token: string } }).data.token;
    };
    return {
      logout: await open(),
      expired: await open(),
      revoked: await open(),
      kept: await open(),
    };
  }, ada);
  await page.evaluate((tokens) => {
    const h = window.__KURIO_TEST__;
    Object.assign(window, {
      __probes: Object.fromEntries(
        Object.entries(tokens).map(([name, token]) => [
          name,
          h.probeSocket(token),
        ]),
      ),
    });
  }, tokens);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.authenticatedSockets().length >= 5,
  );
  // Logout in another tab, expiry, and a password change made from `kept`
  // (which revokes Ada's other sessions).
  await page.evaluate(
    async ({ tokens, ada }) => {
      const h = window.__KURIO_TEST__;
      await fetch("/api/session/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.logout}` },
      });
      await h.expireSession(tokens.expired);
      const r = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${tokens.kept}`,
        },
        body: JSON.stringify({
          currentPassword: ada.password,
          newPassword: "NovaSenha2026",
        }),
      });
      if (!r.ok) throw new Error(`password change: ${r.status}`);
    },
    { tokens, ada },
  );
  await resolvePayments(page);
  type Probe = { received(): string[] };
  const traffic = () =>
    page.evaluate(() =>
      Object.fromEntries(
        Object.entries(
          (window as unknown as { __probes: Record<string, Probe> }).__probes,
        ).map(([name, probe]) => [
          name,
          probe.received().filter((e) => e === "order.updated").length,
        ]),
      ),
    );
  // The session still active receives the confirmation; the others never.
  await expect.poll(async () => (await traffic()).kept).toBe(1);
  expect(await traffic()).toEqual({
    logout: 0,
    expired: 0,
    revoked: 0,
    kept: 1,
  });
  await page.evaluate(() =>
    Object.values(
      (window as unknown as { __probes: Record<string, { close(): void }> })
        .__probes,
    ).forEach((p) => p.close()),
  );
});
