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
const isMobile = (name: string) => name.includes("mobile");
const dialog = (page: Page) => page.getByRole("dialog");
const notices = (page: Page) => page.locator(".notices");
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
// Adds lines (and optionally a coupon) through the real cart API.
async function addLines(page: Page, lines: Line[], coupon?: string) {
  await page.evaluate(
    async ({ lines, coupon }) => {
      const token = window.__KURIO_TEST__.identity().sessionToken;
      const headers = {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      for (const [nftId, editionId, quantity] of lines) {
        const r = await fetch("/api/cart/items", {
          method: "POST",
          headers,
          body: JSON.stringify({ nftId, editionId, quantity }),
        });
        if (!r.ok) throw new Error(await r.text());
      }
      if (coupon)
        await fetch("/api/cart/coupon", {
          method: "PUT",
          headers,
          body: JSON.stringify({ code: coupon }),
        });
    },
    { lines, coupon },
  );
}
const emerald: Line = ["nft-001", "edition-1-limited", 2];
const connected = (page: Page, provider = "MetaMask") =>
  expect(page.locator("#connection-status")).toContainText(
    `${provider} conectada`,
  );
async function openCheckout(page: Page, step = "dados") {
  await page.goto(`/checkout?step=${step}`);
  await ready(page);
}
// The review area (desktop page, or the mobile review step) with the wallet
// connected and a quote shown.
async function toReview(page: Page, mobile: boolean, provider = "MetaMask") {
  await openCheckout(page, mobile ? "revisao" : "dados");
  await connected(page, provider);
  await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
}
const confirmButton = (page: Page) =>
  page.getByRole("button", { name: "Confirmar compra" });
const total = (page: Page) =>
  page.locator(".checkout-amounts .amount-total dd");
// Selects a registered wallet by its label (mobile wallet step, or the
// desktop "Usar outra carteira?" list).
async function chooseWallet(page: Page, mobile: boolean, label: RegExp) {
  if (mobile) {
    if (!/step=carteira/.test(page.url())) await openCheckout(page, "carteira");
  } else {
    const toggle = page.getByRole("button", { name: "Usar outra carteira?" });
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
  }
  await page.getByRole("radio", { name: label }).check();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});
test("1. carrinho → Conectar e finalizar → checkout; deslogado passa pelo login e volta", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const r = await fetch("/api/visitor-sessions", { method: "POST" });
    const token = ((await r.json()) as { data: { token: string } }).data.token;
    localStorage.setItem("kurio.visitor.v1", token);
    await fetch("/api/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Visitor-Token": token },
      body: JSON.stringify({
        nftId: "nft-001",
        editionId: "edition-1-limited",
        quantity: 1,
      }),
    });
  });
  await page.goto("/cart");
  await ready(page);
  await page.getByRole("link", { name: "Conectar e finalizar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/);
  // The cart stays behind the login.
  await expect(page.locator(".cart-table tbody tr")).toHaveCount(1);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/checkout/);
  await expect(
    page.getByRole("heading", {
      name: /Perfil do colecionador|Dados do colecionador/,
    }),
  ).toBeVisible();
  // Signed in, the cart goes straight to the checkout.
  await page.goto("/cart");
  await page.getByRole("link", { name: "Conectar e finalizar" }).click();
  await expect(page).toHaveURL(/\/checkout\?step=dados$/);
  // Direct access and refresh work (the review step lists the items).
  await page.goto("/checkout?step=revisao");
  await page.reload();
  await expect(page.locator(".checkout-items li")).toHaveCount(1);
});
test("2. carrinho vazio ou com conflito não abre o checkout", async ({
  page,
}) => {
  await login(page);
  await openCheckout(page);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(notices(page)).toContainText("Seu carrinho está vazio");
  await addLines(page, [emerald]);
  await page.evaluate(() =>
    window.__KURIO_TEST__.persistUpdate("nft-001", "edition-1-limited", {
      available: 0,
    }),
  );
  await openCheckout(page);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(notices(page)).toContainText("Resolva os itens indisponíveis");
});
test("3. pré-preenchimento pela carteira e pela conta; trocar de carteira não sobrescreve o digitado", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await openCheckout(page);
  const field = (name: string) =>
    page.locator(".checkout-fields").getByLabel(name, { exact: false });
  await expect(field("Nome de exibição")).toHaveValue("Ada Example");
  await expect(field("Nome de usuário")).toHaveValue("ada_example");
  await expect(field("E-mail")).toHaveValue("ada@example.test");
  await expect(field("Nome do perfil")).toHaveValue("Ada Colecionadora");
  await expect(page.locator("#checkout-network")).toHaveValue("Ethereum");
  await expect(page.locator("#checkout-provider")).toHaveValue("MetaMask");
  await field("Nome de exibição").fill("Coleção da Ada");
  await chooseWallet(page, mobile, /Reserva/);
  if (mobile) await openCheckout(page, "dados");
  // Typed values win; untouched fields follow the new wallet.
  await expect(field("Nome de exibição")).toHaveValue("Coleção da Ada");
  await expect(page.locator("#checkout-network")).toHaveValue("Polygon");
  await expect(page.locator("#checkout-provider")).toHaveValue(
    "Coinbase Wallet",
  );
  await expect(page.locator("#checkout-address")).toHaveValue(
    /^0x7c3D9e1A5b8F/,
  );
});
test("4. validação por campo; ENS e indicação são opcionais", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await openCheckout(page);
  const field = (name: string) =>
    page.locator(".checkout-fields").getByLabel(name, { exact: false });
  await field("Nome de exibição").fill("");
  // Format rules are not shown up front (as in the frame); they appear in
  // the error after an invalid submission.
  await expect(page.locator(".checkout-fields .auth-hint")).toHaveCount(1); // note counter
  await field("Código de indicação").fill("ab");
  await field("ENS ou carteira secundária").fill("0x123");
  const submit = mobile
    ? page.getByRole("button", { name: "Continuar" })
    : confirmButton(page);
  if (!mobile) await connected(page);
  await submit.click();
  await expect(field("Nome de exibição")).toBeFocused();
  await expect(field("Nome de exibição")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#checkout-referralCode-error")).toContainText(
    "letras maiúsculas",
  );
  // Nome ENS is the frame's dropdown: ".eth" (none) or a wallet's ENS name.
  const ens = page.getByLabel("Nome ENS");
  await expect(ens).toHaveValue("");
  await expect(ens.locator("option")).toHaveText([".eth", "nova.kurio.eth"]);
  await ens.selectOption("nova.kurio.eth");
  await expect(
    page.locator("#checkout-secondaryAddressOrEns-error"),
  ).toContainText("endereço válido para a rede");
  // Optional fields left empty, a valid secondary ENS: no errors.
  await field("Nome de exibição").fill("Ada");
  await field("Código de indicação").fill("");
  await field("ENS ou carteira secundária").fill("reserva.eth");
  await submit.click();
  if (mobile) await expect(page).toHaveURL(/step=carteira/);
  else await expect(dialog(page)).toContainText("Revisão concluída");
});
test("5. usuário sem carteiras cadastra uma no checkout; vira principal e fica selecionada; a API recusa endereço inválido e duplicado", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page, lin);
  await addLines(page, [emerald]);
  await openCheckout(page, mobile ? "carteira" : "dados");
  if (mobile) {
    // The wallet step needs valid collector data first.
    await expect(page).toHaveURL(/step=dados/);
    await page.getByLabel("Nome do perfil", { exact: false }).fill("Lin");
    await page.getByRole("button", { name: "Continuar" }).click();
  }
  const form = page.getByRole("form", { name: "Cadastrar nova carteira" });
  await expect(form.getByLabel("Nome da carteira")).not.toBeFocused();
  await form.getByLabel("Nome da carteira").fill("Minha MetaMask");
  await form.getByLabel("Endereço da carteira").fill("0x123");
  await form.getByRole("button", { name: "Cadastrar carteira" }).click();
  await expect(form.getByLabel("Endereço da carteira")).toBeFocused();
  await expect(form.locator("#wallet-form-address-error")).toContainText(
    "0x seguido de 40",
  );
  const address = "0x1111111111111111111111111111111111111111";
  await form.getByLabel("Endereço da carteira").fill(address);
  await form.getByRole("button", { name: "Cadastrar carteira" }).click();
  // The new wallet is the user's primary one.
  const roles = await page.evaluate(async () => {
    const token = window.__KURIO_TEST__.identity().sessionToken;
    const r = await fetch("/api/wallets", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return ((await r.json()) as { data: { role: string }[] }).data.map(
      (w) => w.role,
    );
  });
  expect(roles).toEqual(["primary"]);
  await expect(
    page.getByRole("radio", { name: /Minha MetaMask/ }),
  ).toBeChecked();
  await connected(page);
  // The API itself refuses an invalid and a duplicate address.
  const responses = await page.evaluate(async (address) => {
    const token = window.__KURIO_TEST__.identity().sessionToken;
    const post = (body: object) =>
      fetch("/api/wallets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json() }));
    return {
      invalid: await post({
        address: "0xZZ",
        network: "polygon",
        provider: "metamask",
        label: "X",
      }),
      duplicate: await post({
        address: address.toUpperCase().replace("0X", "0x"),
        network: "ethereum",
        provider: "metamask",
        label: "Y",
      }),
      second: await post({
        address: "0x2222222222222222222222222222222222222222",
        network: "polygon",
        provider: "coinbase-wallet",
        label: "Z",
      }),
    };
  }, address);
  expect(responses.invalid.status).toBe(400);
  expect(responses.invalid.body.error.fields.address).toBeTruthy();
  expect(responses.duplicate.status).toBe(409);
  expect(responses.duplicate.body.error.fields.address).toContain(
    "já está cadastrada",
  );
  expect(responses.second.status).toBe(201);
  expect(responses.second.body.data.role).toBe("secondary");
});
test("6. conexão aprovada, recusada com nova tentativa e desconexão detectada antes de confirmar", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await page.evaluate(() =>
    window.__KURIO_TEST__.checkoutDelay("connection", 400),
  );
  await openCheckout(page, mobile ? "carteira" : "dados");
  await expect(page.locator("#connection-status")).toContainText(
    "Conectando à MetaMask…",
  );
  await connected(page);
  // The next connection is rejected; retrying connects.
  await page.evaluate(() => window.__KURIO_TEST__.rejectNextConnection());
  await chooseWallet(page, mobile, /Reserva/);
  await expect(page.locator("#connection-status")).toContainText(
    "Conexão recusada na carteira.",
  );
  await expect(
    confirmButton(page).or(page.getByRole("button", { name: "Continuar" })),
  ).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await connected(page, "Coinbase Wallet");
  // Disconnected on the server: detected when confirming (and on focus).
  await page.evaluate(() => window.__KURIO_TEST__.disconnectWallets());
  if (mobile) {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  } else await confirmButton(page).click();
  await expect(page.locator("#connection-status")).toContainText(
    "A carteira foi desconectada",
  );
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Reconectar" }).click();
  await connected(page, "Coinbase Wallet");
});
test("7. a taxa segue a rede da carteira e os valores vêm da API", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await toReview(page, mobile);
  const amounts = page.locator(".checkout-amounts");
  await expect(amounts).toContainText("Taxa de rede (Ethereum)");
  await expect(amounts).toContainText("0.016 ETH");
  await expect(total(page)).toHaveText("2.396 ETH");
  await chooseWallet(page, mobile, /Reserva/);
  if (mobile) await openCheckout(page, "revisao");
  await connected(page, "Coinbase Wallet");
  await expect(amounts).toContainText("Taxa de rede (Polygon)");
  await expect(amounts).toContainText("0.002 ETH");
  await expect(total(page)).toHaveText("2.382 ETH");
});
test("8. revalidação: preço, esgotamento, cupom expirado e cotação expirada exigem nova confirmação; sem mudanças, aviso dos pedidos", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald], "KURIO10");
  await toReview(page, mobile);
  // No change: the honest unavailability dialog, no order.
  await confirmButton(page).click();
  await expect(dialog(page)).toContainText("Nenhum pedido foi criado");
  await page.keyboard.press("Escape");
  // Price changed silently on the server (no event): caught on confirm.
  await page.evaluate(() =>
    window.__KURIO_TEST__.persistUpdate("nft-001", "edition-1-limited", {
      priceEth: "1.5",
    }),
  );
  await confirmButton(page).click();
  const changes = page.locator(".quote-changes");
  await expect(changes).toContainText("preço de 1.19 ETH para 1.50 ETH");
  await expect(dialog(page)).toHaveCount(0);
  await expect(confirmButton(page)).toHaveAttribute("aria-disabled", "true");
  await page
    .getByRole("button", { name: "Revisei, confirmar com os novos valores" })
    .click();
  await expect(dialog(page)).toContainText("Revisão concluída");
  await page.keyboard.press("Escape");
  // Coupon expired after it was applied.
  await page.evaluate(() => window.__KURIO_TEST__.expireCoupon("KURIO10"));
  await confirmButton(page).click();
  await expect(changes).toContainText("O cupom KURIO10 expirou");
  await page
    .getByRole("button", { name: "Revisei, confirmar com os novos valores" })
    .click();
  await expect(dialog(page)).toContainText("Revisão concluída");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator(".checkout-amounts")).not.toContainText("KURIO10");
  // Sold out: the quote refuses with the affected item.
  await page.evaluate(() =>
    window.__KURIO_TEST__.persistUpdate("nft-001", "edition-1-limited", {
      available: 1,
    }),
  );
  await confirmButton(page).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "não estão mais disponíveis" }),
  ).toContainText("disponível no máximo 1");
  await expect(dialog(page)).toHaveCount(0);
});
test("8b. cotação expirada é renovada automaticamente e pede confirmação se os valores mudaram", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await page.evaluate(() => window.__KURIO_TEST__.quoteTtl(1500));
  await toReview(page, mobile);
  await expect(total(page)).toHaveText("2.396 ETH");
  await page.evaluate(() =>
    window.__KURIO_TEST__.persistUpdate("nft-001", "edition-1-limited", {
      priceEth: "2",
    }),
  );
  // No click: the expiry renews the quote and shows what changed.
  await expect(page.locator(".quote-changes")).toContainText(
    "preço de 1.19 ETH para 2.00 ETH",
    { timeout: 5000 },
  );
  await expect(total(page)).toHaveText("2.396 ETH");
});
test("9. nft.updated durante o checkout gera aviso e nova cotação", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await toReview(page, mobile);
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "1.25",
    }),
  );
  await expect(page.locator(".quote-changes")).toContainText(
    "preço de 1.19 ETH para 1.25 ETH",
  );
  await expect(notices(page)).not.toContainText("1.25");
  // The values about to be confirmed were not swapped in silence.
  await expect(total(page)).toHaveText("2.396 ETH");
  await page
    .getByRole("button", { name: "Revisei, confirmar com os novos valores" })
    .click();
  await page.keyboard.press("Escape");
  await expect(total(page)).toHaveText("2.516 ETH");
});
test("10. mobile: passos na URL com voltar, avançar e refresh; não avança com passo inválido", async ({
  page,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "fluxo em passos é do mobile");
  await login(page, lin);
  await addLines(page, [emerald]);
  await openCheckout(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Dados do colecionador");
  // Lin has no wallet and no profile name: the first step is invalid.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/step=dados/);
  await expect(
    page.getByLabel("Nome do perfil", { exact: false }),
  ).toBeFocused();
  // A deep link to a later step goes back to the step that needs attention.
  await openCheckout(page, "revisao");
  await expect(page).toHaveURL(/step=dados/);
  await page.getByLabel("Nome do perfil", { exact: false }).fill("Lin");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/step=carteira/);
  await expect(heading).toHaveText("Pagamento com carteira");
  await expect(heading).toBeFocused();
  // No connected wallet yet: cannot advance (the action is disabled and
  // described by the connection status).
  const next = page.getByRole("button", { name: "Continuar" });
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await expect(next).toHaveAttribute("aria-describedby", "connection-status");
  await next.dispatchEvent("click");
  await expect(page).toHaveURL(/step=carteira/);
  const form = page.getByRole("form", { name: "Cadastrar nova carteira" });
  await form.getByLabel("Nome da carteira").fill("Principal");
  await form
    .getByLabel("Endereço da carteira")
    .fill("0x3333333333333333333333333333333333333333");
  await form.getByRole("button", { name: "Cadastrar carteira" }).click();
  await connected(page);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/step=revisao/);
  await expect(heading).toHaveText("Revisão do pedido");
  await expect(page.locator(".checkout-amounts")).toContainText("Subtotal");
  await page.goBack();
  await expect(page).toHaveURL(/step=carteira/);
  await page.goForward();
  await expect(page).toHaveURL(/step=revisao/);
  await page.reload();
  await expect(heading).toHaveText("Revisão do pedido");
  await expect(page.getByLabel("Nome do perfil", { exact: false })).toHaveCount(
    0,
  );
  await connected(page);
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/step=carteira/);
});
test("11. expiração no checkout preserva o rascunho; logout e troca de usuário o descartam", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await openCheckout(page);
  await page
    .locator(".checkout-fields")
    .getByLabel("Nome de exibição", { exact: false })
    .fill("Rascunho da Ada");
  // On mobile the connection lives on the wallet step.
  if (mobile) await page.getByRole("button", { name: "Continuar" }).click();
  await connected(page);
  await page.evaluate(() => window.__KURIO_TEST__.expireSession());
  // The next private request (the connection check on focus) gets a 401.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(notices(page)).toContainText("Sua sessão expirou");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/checkout/);
  if (mobile) await openCheckout(page, "dados");
  await expect(
    page.locator(".checkout-fields").getByLabel("Nome de exibição", {
      exact: false,
    }),
  ).toHaveValue("Rascunho da Ada");
  // Logout discards the draft and the user's wallets.
  if (mobile) {
    await page.goto("/");
    await page.getByRole("button", { name: "Minha conta" }).click();
    await dialog(page).getByRole("button", { name: "Sair" }).click();
  } else {
    await page.getByRole("button", { name: "Conta de Ada Example" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
  }
  await expect(notices(page)).toContainText("Você saiu da sua conta.");
  const stored = await page.evaluate(() => ({
    drafts: Object.keys(sessionStorage).filter((k) =>
      k.startsWith("kurio.checkout.draft"),
    ),
  }));
  expect(stored.drafts).toHaveLength(0);
  // Another user never sees Ada's draft or wallets.
  await login(page, lin);
  await addLines(page, [emerald]);
  await openCheckout(page);
  await expect(
    page.getByLabel("Nome de exibição", { exact: false }),
  ).toHaveValue("Lin Example");
  if (mobile) await openCheckout(page, "carteira");
  await expect(
    page.getByRole("radio", { name: /Principal|Reserva/ }),
  ).toHaveCount(0);
  // A draft left by an expired session of another user is discarded too.
  await page.evaluate(() =>
    sessionStorage.setItem(
      "kurio.checkout.draft.v1:user-ada",
      JSON.stringify({ fields: { displayName: "Antigo" }, walletId: null }),
    ),
  );
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  await login(page, lin);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("kurio.checkout.draft.v1:user-ada"),
    ),
  ).toBeNull();
});
test("12. teclado e foco: grupos de rádio, cadastro de carteira e avisos", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addLines(page, [emerald]);
  await openCheckout(page, mobile ? "carteira" : "dados");
  await connected(page);
  if (!mobile)
    await page.getByRole("button", { name: "Usar outra carteira?" }).click();
  const principal = page.getByRole("radio", { name: /Principal/ });
  await principal.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /Reserva/ })).toBeFocused();
  await expect(page.getByRole("radio", { name: /Reserva/ })).toBeChecked();
  await connected(page, "Coinbase Wallet");
  // Provider radios move with arrows and follow the registered wallet.
  const coinbase = page.getByRole("radio", { name: "Coinbase Wallet" });
  await expect(coinbase).toBeChecked();
  await coinbase.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: "MetaMask" })).toBeChecked();
  await connected(page);
  // No WalletConnect wallet: choosing it offers the registration form, with
  // focus on its first field and the provider preselected.
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".provider-missing [role=status]")).toContainText(
    "Você não tem uma carteira WalletConnect cadastrada.",
  );
  const form = page.getByRole("form", { name: "Cadastrar nova carteira" });
  await expect(form.getByLabel("Nome da carteira")).toBeFocused();
  await expect(form.getByLabel("Provedor")).toHaveValue("walletconnect");
  await form.getByRole("button", { name: "Cancelar" }).click();
  // Notices are announced once, in the single polite region.
  await expect(page.locator("[role=status].notices")).toHaveCount(1);
  // The "⋮" menu explains that editing comes later.
  await page
    .getByRole("button", { name: /Opções da carteira Principal/ })
    .click();
  await expect(dialog(page)).toContainText("A edição de carteiras chega");
});
