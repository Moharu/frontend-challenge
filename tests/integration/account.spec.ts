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
async function login(page: Page, credentials = ada, target = "/") {
  await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
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
  init: { method?: string; body?: unknown; token?: string | null } = {},
) {
  return page.evaluate(
    async ({ path, init }) => {
      const token =
        init.token === undefined
          ? window.__KURIO_TEST__.identity().sessionToken
          : init.token;
      const r = await fetch(`/api${path}`, {
        method: init.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await r.text();
      return { status: r.status, body: text ? JSON.parse(text) : null };
    },
    { path, init },
  );
}
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const status = (page: Page) => page.locator(".account-summary");
// The account menu: the sidebar on desktop; on mobile, the disclosure.
async function goSection(page: Page, mobile: boolean, label: string) {
  if (mobile) {
    const toggle = page.locator(".account-disclosure");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await page
    .getByRole("navigation", { name: "Meu perfil" })
    .getByRole("link", { name: label })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});
test("1. navegação: rotas, item marcado, seções indisponíveis, disclosure mobile e retorno após login", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  // Signed out: the login, then back to the section.
  await page.goto("/account/wallets");
  await ready(page);
  await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets/);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/account\/wallets$/);
  await expect(
    page.getByRole("heading", { name: "Carteira principal" }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/profile$/);
  if (mobile) {
    // The open list floats over the section (nothing moves); Escape closes
    // it and returns focus to the button.
    const toggle = page.locator(".account-disclosure");
    const before = await heading(page).boundingBox();
    await toggle.click();
    await expect(page.locator(".account-sections")).toBeVisible();
    expect((await heading(page).boundingBox())?.y).toBe(before?.y);
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  }
  for (const [label, path, title] of [
    ["Carteiras", "wallets", null],
    ["Atividade", "activity", "Atividade"],
    ["Lista de interesse", "favorites", "Lista de interesse"],
    ["Ofertas", "offers", "Ofertas"],
    ["Arquivos baixados", "downloads", "Arquivos baixados"],
    ["Suporte", "support", "Suporte"],
    ["Dados do perfil", "profile", "Perfil do colecionador"],
  ] as const) {
    await goSection(page, mobile, label);
    await expect(page).toHaveURL(new RegExp(`/account/${path}$`));
    // (On mobile the list is collapsed again: checked by its link.)
    await expect(
      page.locator(`.account-sections a[href="/account/${path}"]`),
    ).toHaveAttribute("aria-current", "page");
    if (title) await expect(heading(page)).toHaveText(title);
    if (["activity", "offers", "downloads", "support"].includes(path))
      await expect(page.locator(".account-section")).toContainText(
        "Esta seção não está disponível nesta versão.",
      );
    if (mobile) {
      // The disclosure collapses after the choice and keeps the focus.
      const toggle = page.locator(".account-disclosure");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toBeFocused();
      await expect(toggle).toContainText(label);
    }
  }
  // History works as usual.
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/support$/);
});
test("2. perfil: salvar, refresh mantém, cabeçalho reflete; 409 de nome em uso e de versão", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page, ada, "/account/profile");
  await expect(page.getByLabel("Nome de usuário")).toHaveValue("ada_example");
  await page.getByLabel("Nome de exibição").fill("Ada Lovelace");
  await page.getByRole("textbox", { name: "Nome ENS" }).fill("ada");
  await page.getByLabel("Apelido da carteira").fill("Cofre");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText("Alterações salvas.");
  await expect(status(page)).toContainText("Dados do perfil: salvos.");
  if (!mobile)
    await expect(
      page.getByRole("button", { name: "Conta de Ada Lovelace" }),
    ).toBeVisible();
  expect((await api(page, "/session")).body.data.user.displayName).toBe(
    "Ada Lovelace",
  );
  await page.reload();
  await expect(page.getByLabel("Nome de exibição")).toHaveValue("Ada Lovelace");
  await expect(page.getByRole("textbox", { name: "Nome ENS" })).toHaveValue(
    "ada",
  );
  expect((await api(page, "/profile")).body.data).toMatchObject({
    ensName: "ada.eth",
    walletNickname: "Cofre",
  });
  // Username in use by another account: 409 on the field.
  await page.getByLabel("Nome de usuário").fill("lin_example");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("#profile-username-error")).toHaveText(
    "Este nome de usuário já está em uso.",
  );
  await expect(page.getByLabel("Nome de usuário")).toBeFocused();
  await expect(status(page)).toContainText("Nada foi salvo.");
  // An older version: 409.
  const stale = await api(page, "/profile", {
    method: "PATCH",
    body: { version: 1, bio: "x" },
  });
  expect(stale.status).toBe(409);
  // Username and e-mail never accept null.
  const nulled = await api(page, "/profile", {
    method: "PATCH",
    body: { version: 2, email: null },
  });
  expect(nulled.status).toBe(400);
});
// An image of the given size and type, drawn in the page.
async function image(page: Page, width: number, height: number, type: string) {
  const dataUrl = await page.evaluate(
    ({ width, height, type }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      for (let i = 0; i < 400; i++) {
        context.fillStyle = `hsl(${i * 37}, 70%, 50%)`;
        context.fillRect(
          (i * 53) % width,
          (i * 97) % height,
          width / 7,
          height / 9,
        );
      }
      return canvas.toDataURL(type);
    },
    { width, height, type },
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}
test("3. avatar: prévia, salvar 256×256, refresh, remover; tipo e tamanho recusados", async ({
  page,
}) => {
  await login(page, ada, "/account/profile");
  const input = page.locator("#profile-avatar");
  await input.setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: await image(page, 640, 400, "image/png"),
  });
  await expect(
    page.getByRole("img", { name: "Prévia do novo avatar" }),
  ).toBeVisible();
  // Nothing is saved before "Salvar".
  expect((await api(page, "/profile")).body.data.avatar).toBeNull();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText("Avatar: salvo.");
  await page.reload();
  const saved = page.getByRole("img", { name: "Avatar de ada_example" });
  await expect(saved).toBeVisible();
  const size = await saved.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return [img.naturalWidth, img.naturalHeight, img.src.slice(0, 15)];
  });
  expect(size.slice(0, 2)).toEqual([256, 256]);
  expect(size[2]).toMatch(/^data:image\/(webp|jpeg)/);
  // Remove, then save.
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(saved).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText("Avatar: removido.");
  expect((await api(page, "/profile")).body.data.avatar).toBeNull();
  // Refused in the browser: an unsupported type and a source over 5 MB.
  await input.setInputFiles({
    name: "a.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(page.locator("#profile-avatar-error")).toHaveText(
    "Escolha uma imagem WebP, JPEG ou PNG.",
  );
  await input.setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator("#profile-avatar-error")).toHaveText(
    "A imagem deve ter no máximo 5 MB.",
  );
  // Refused by the API: another type and over 150 KB.
  const version = (await api(page, "/profile")).body.data.version;
  const gif = await api(page, "/profile/avatar", {
    method: "PUT",
    body: { version, dataUrl: "data:image/gif;base64,R0lGODlh" },
  });
  expect(gif.status).toBe(400);
  expect(gif.body.error.fields.avatar).toBeTruthy();
  const big = await api(page, "/profile/avatar", {
    method: "PUT",
    body: {
      version,
      dataUrl: `data:image/png;base64,${"A".repeat(Math.ceil((151 * 1024 * 4) / 3))}`,
    },
  });
  expect(big.status).toBe(400);
});
test("4. senha: atual errada no campo; troca válida entra com a nova e não com a antiga; nada em claro", async ({
  page,
}) => {
  await login(page, lin, "/account/profile");
  await page.getByLabel("Senha atual", { exact: true }).fill("Errada2026");
  await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha2026");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("NovaSenha2026");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("#profile-currentPassword-error")).toHaveText(
    "A senha atual está incorreta.",
  );
  await expect(page.getByLabel("Senha atual", { exact: true })).toBeFocused();
  // Confirmation is checked in the browser only.
  await page.getByLabel("Senha atual", { exact: true }).fill(lin.password);
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("Outra2026");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("#profile-confirm-error")).toBeVisible();
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("NovaSenha2026");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText("Senha: alterada.");
  await expect(page.getByLabel("Senha atual", { exact: true })).toHaveValue("");
  // The current session stays valid.
  expect((await api(page, "/profile")).status).toBe(200);
  const raw = await page.evaluate(() =>
    localStorage.getItem("kurio.mock.catalog.v1"),
  );
  expect(raw).not.toContain("NovaSenha2026");
  expect(raw).not.toContain(lin.password);
  const attempt = (password: string) =>
    page.evaluate(
      async ({ email, password }) =>
        (
          await fetch("/api/session/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
          })
        ).status,
      { email: lin.email, password },
    );
  expect(await attempt(lin.password)).toBe(401);
  expect(await attempt("NovaSenha2026")).toBe(200);
});
test("5. falha parcial: dados salvos e senha recusada no mesmo Salvar", async ({
  page,
}) => {
  await login(page, lin, "/account/profile");
  await page.getByLabel("Nome de exibição").fill("Lin Parcial");
  await page.getByLabel("Senha atual", { exact: true }).fill("Errada2026");
  await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha2026");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("NovaSenha2026");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText(
    "Algumas alterações foram salvas; revise o que falhou.",
  );
  await expect(status(page)).toContainText("Dados do perfil: salvos.");
  await expect(status(page)).toContainText("Senha: não salvo.");
  await expect(page.locator("#profile-currentPassword-error")).toBeVisible();
  // What failed keeps what was typed; what succeeded is saved.
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveValue(
    "NovaSenha2026",
  );
  expect((await api(page, "/profile")).body.data.displayName).toBe(
    "Lin Parcial",
  );
});
test("6. carteiras: editar a principal, adicionar secundária com Igual à principal, limite e recusas da API", async ({
  page,
}) => {
  await login(page, lin, "/account/wallets");
  const primary = page.getByRole("region", { name: "Carteira principal" });
  await expect(primary).toContainText(
    "Você ainda não adicionou uma carteira principal.",
  );
  await primary
    .getByRole("button", { name: "Adicionar carteira principal" })
    .click();
  await primary.getByLabel("Nome de exibição").fill("Lin Example");
  await primary.getByLabel("Apelido da carteira").fill("Principal");
  await primary.getByLabel("Rede").selectOption("ethereum");
  await primary.getByLabel("Nome do perfil").fill("Lin Colecionadora");
  await primary.getByLabel("Endereço da carteira").fill("0xabc");
  await primary.getByLabel("Tipo de carteira").selectOption("metamask");
  await primary.getByLabel("E-mail").fill("lin@example.test");
  await primary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(primary.locator("#wallet-primary-address-error")).toBeVisible();
  await expect(primary.getByLabel("Endereço da carteira")).toBeFocused();
  await primary
    .getByLabel("Endereço da carteira")
    .fill("0x1111111111111111111111111111111111111111");
  await primary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(primary.locator(".account-summary")).toHaveText(
    "Carteira principal salva.",
  );
  // Editing it: refresh keeps the change.
  await primary.getByLabel("Apelido da carteira").fill("Cofre principal");
  await primary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect
    .poll(async () => (await api(page, "/wallets")).body.data[0].label)
    .toBe("Cofre principal");
  await expect(primary.locator(".account-summary")).toHaveText(
    "Carteira principal salva.",
  );
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Carteira principal" })
      .getByLabel("Apelido da carteira"),
  ).toHaveValue("Cofre principal");
  // Secondary: "Igual à carteira principal" fills the descriptive fields,
  // never the address.
  const secondary = page.getByRole("region", { name: "Carteira secundária" });
  await expect(secondary).toContainText(
    "Você ainda não adicionou uma carteira secundária.",
  );
  await secondary
    .getByRole("button", { name: "Igual à carteira principal" })
    .click();
  await expect(secondary.getByLabel("Nome de exibição")).toHaveValue(
    "Lin Example",
  );
  await expect(secondary.getByLabel("Nome do perfil")).toHaveValue(
    "Lin Colecionadora",
  );
  await expect(secondary.getByLabel("E-mail")).toHaveValue("lin@example.test");
  await expect(secondary.getByLabel("Endereço da carteira")).toHaveValue("");
  await secondary.getByLabel("Apelido da carteira").fill("Reserva");
  await secondary.getByLabel("Rede").selectOption("polygon");
  await secondary
    .getByLabel("Tipo de carteira")
    .selectOption("coinbase-wallet");
  // Same address as the primary (any case): 409 on the field.
  await secondary
    .getByLabel("Endereço da carteira")
    .fill(
      "0x1111111111111111111111111111111111111111"
        .toUpperCase()
        .replace("0X", "0x"),
    );
  await secondary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(secondary.locator("#wallet-secondary-address-error")).toHaveText(
    "Esta carteira já está cadastrada na sua conta.",
  );
  await secondary
    .getByLabel("Endereço da carteira")
    .fill("0x2222222222222222222222222222222222222222");
  await secondary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(secondary.locator(".account-summary")).toHaveText(
    "Carteira secundária salva.",
  );
  const wallets = (await api(page, "/wallets")).body.data;
  expect(wallets.map((w: { role: string }) => w.role)).toEqual([
    "primary",
    "secondary",
  ]);
  // Limit: a third wallet is a 409.
  const third = await api(page, "/wallets", {
    method: "POST",
    body: {
      address: "0x3333333333333333333333333333333333333333",
      network: "ethereum",
      provider: "metamask",
      label: "Terceira",
    },
  });
  expect(third.status).toBe(409);
  // Stale version and invalid address through PATCH.
  const id = wallets[0].id;
  expect(
    (
      await api(page, `/wallets/${id}`, {
        method: "PATCH",
        body: { version: 1, label: "x" },
      })
    ).status,
  ).toBe(409);
  const invalid = await api(page, `/wallets/${id}`, {
    method: "PATCH",
    body: { version: wallets[0].version, address: "0x12" },
  });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error.fields.address).toBeTruthy();
});
test("7. editar o endereço da carteira conectada encerra a conexão; o recibo não muda", async ({
  page,
}) => {
  await login(page);
  await api(page, "/cart/items", {
    method: "POST",
    body: { nftId: "nft-001", editionId: "edition-1-limited", quantity: 1 },
  });
  const walletId = "wallet-ada-primary";
  const connection = (
    await api(page, "/wallet-connections", {
      method: "POST",
      body: { walletId },
    })
  ).body.data;
  const cart = (await api(page, "/cart")).body.data;
  const quote = (
    await api(page, "/quotes", {
      method: "POST",
      body: { cartId: cart.id, cartVersion: cart.version, walletId },
    })
  ).body.data;
  await page.evaluate(() =>
    window.__KURIO_TEST__.setPayment({ status: "confirmed" }, 0),
  );
  const order = await page.evaluate(
    async ({ quote, walletId }) => {
      const token = window.__KURIO_TEST__.identity().sessionToken;
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "account-receipt-0000-0001",
        },
        body: JSON.stringify({
          quoteId: quote.id,
          quoteVersion: quote.version,
          walletId,
          collector: {
            displayName: "Ada Example",
            username: "ada_example",
            email: "ada@example.test",
            profileName: "Ada Colecionadora",
          },
        }),
      });
      return (await r.json()).data;
    },
    { quote, walletId },
  );
  await page.evaluate(() => window.__KURIO_TEST__.resolvePayments());
  const before = (await api(page, `/orders/${order.id}/receipt`)).body.data;
  // A new connection (the order is done), then the address changes in
  // the account: the connection ends.
  const active = (
    await api(page, "/wallet-connections", {
      method: "POST",
      body: { walletId },
    })
  ).body.data;
  expect(active.status).toBe("active");
  void connection;
  await page.goto("/account/wallets");
  const primary = page.getByRole("region", { name: "Carteira principal" });
  await primary
    .getByLabel("Endereço da carteira")
    .fill("0x9999999999999999999999999999999999999999");
  await primary.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(primary.locator(".account-summary")).toHaveText(
    "Carteira principal salva.",
  );
  expect(
    (await api(page, `/wallet-connections/${active.id}`)).body.data.status,
  ).toBe("disconnected");
  const after = (await api(page, `/orders/${order.id}/receipt`)).body.data;
  expect(after.wallet).toEqual(before.wallet);
  expect(after.wallet.address).toBe(
    "0xA91F3c5e7B2d4a6F8091bC3d5E7f9A1b2C4dE82C",
  );
});
const firstCard = (page: Page) => page.locator(".nft-grid .nft-card").first();
test("8. favoritos: cartão e detalhe, refresh mantém, Lista de interesse", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");
  await expect(firstCard(page)).toBeVisible();
  const heart = page.getByRole("button", {
    name: "Favoritar Emerald Ape #042",
  });
  await heart.click();
  const pressed = page.getByRole("button", {
    name: "Remover Emerald Ape #042 dos favoritos",
  });
  await expect(pressed).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".notices")).toContainText(
    "Emerald Ape #042 adicionado aos favoritos.",
  );
  // Detail: the same state; favorite another one from there.
  await page.goto("/nfts/nft-002");
  await page.getByRole("button", { name: "Favoritar Sage Nomad #043" }).click();
  await expect(
    page.getByRole("button", { name: "Remover Sage Nomad #043 dos favoritos" }),
  ).toHaveText("Favoritado");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remover Sage Nomad #043 dos favoritos" }),
  ).toBeVisible();
  await page.goto("/account/favorites");
  const cards = page.locator(".account-favorites .nft-card");
  await expect(cards).toHaveCount(2);
  // Removing in the list (same optimistic update).
  await page
    .getByRole("button", { name: "Remover Emerald Ape #042 dos favoritos" })
    .click();
  await expect(cards).toHaveCount(1);
  await expect
    .poll(async () => (await api(page, "/favorites")).body.data.length)
    .toBe(1);
  // Unfavoriting the last one shows the honest empty state.
  await page
    .getByRole("button", { name: "Remover Sage Nomad #043 dos favoritos" })
    .click();
  await expect(page.locator(".account-empty")).toContainText(
    "Você ainda não favoritou nenhum NFT.",
  );
});
test("9. reversão otimista: falha HTTP e de rede revertem e anunciam; cliques rápidos terminam coerentes", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");
  await expect(firstCard(page)).toBeVisible();
  const off = page.getByRole("button", { name: "Favoritar Emerald Ape #042" });
  const on = page.getByRole("button", {
    name: "Remover Emerald Ape #042 dos favoritos",
  });
  for (const kind of ["http", "network"] as const) {
    await page.evaluate((kind) => {
      window.__KURIO_TEST__.favoriteDelay(300);
      window.__KURIO_TEST__.failNextFavorite(kind);
    }, kind);
    await off.click();
    // Optimistic: pressed at once, then rolled back.
    await expect(on).toHaveAttribute("aria-pressed", "true");
    await expect(off).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".notices")).toContainText(
      "Não foi possível favoritar Emerald Ape #042. Tente novamente.",
    );
    expect((await api(page, "/favorites")).body.data).toEqual([]);
  }
  // Rapid clicks: odd count ends favorited, matching the API.
  await page.evaluate(() => window.__KURIO_TEST__.favoriteDelay(150));
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '.nft-card button.favorite[aria-label*="Emerald Ape #042"]',
    )!;
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () =>
      (await api(page, "/favorites")).body.data.map(
        (f: { nftId: string }) => f.nftId,
      ),
    )
    .toEqual(["nft-001"]);
  // Even count from favorited: ends unfavorited, matching the API.
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '.nft-card button.favorite[aria-pressed="true"]',
    )!;
    for (let i = 0; i < 4; i++) button.click();
  });
  await expect
    .poll(async () => (await api(page, "/favorites")).body.data.length)
    .toBe(1);
  // Every request the clicks started has finished.
  await page.waitForFunction(() => {
    const { started, completed, cancelled } =
      window.__KURIO_TEST__.state().requests;
    return started === completed + cancelled;
  });
  await expect(on).toHaveAttribute("aria-pressed", "true");
  expect((await api(page, "/favorites")).body.data.length).toBe(1);
});
test("10. isolamento: outro usuário não vê favoritos, perfil nem carteiras", async ({
  page,
}) => {
  await login(page);
  await api(page, "/favorites", { method: "POST", body: { nftId: "nft-001" } });
  await page.goto("/account/favorites");
  await expect(page.locator(".account-favorites .nft-card")).toHaveCount(1);
  await page.goto("/account/wallets");
  await expect(
    page
      .getByRole("region", { name: "Carteira principal" })
      .getByLabel("Apelido da carteira"),
  ).toHaveValue("Principal");
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  // Lin: no cached value of Ada's at any moment.
  const seen: string[] = [];
  await page.exposeFunction("recordAccount", (text: string) => seen.push(text));
  await page.addInitScript(() => {
    new MutationObserver(() =>
      (
        window as unknown as { recordAccount: (t: string) => void }
      ).recordAccount(
        document.querySelector(".account-content")?.textContent ?? "",
      ),
    ).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await login(page, lin, "/account/favorites");
  await expect(page.locator(".account-empty")).toBeVisible();
  await page.goto("/account/wallets");
  await expect(
    page.getByRole("region", { name: "Carteira principal" }),
  ).toContainText("Você ainda não adicionou uma carteira principal.");
  await page.goto("/account/profile");
  await expect(page.getByLabel("Nome de usuário")).toHaveValue("lin_example");
  expect(seen.join(" ")).not.toContain("Emerald Ape");
  expect(seen.join(" ")).not.toContain("ada_example");
  // The API refuses another user's favorites list from Lin's token: it only
  // ever answers Lin's own.
  expect((await api(page, "/favorites")).body.data).toEqual([]);
});
test("11. deslogado: o coração leva ao login e volta à página, sem favoritar sozinho", async ({
  page,
}) => {
  await page.goto("/nfts/nft-002");
  await ready(page);
  await page
    .getByRole("link", {
      name: "Favoritar Sage Nomad #043 (entre na sua conta)",
    })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fnfts%2Fnft-002/);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/nfts\/nft-002$/);
  await expect(
    page.getByRole("button", { name: "Favoritar Sage Nomad #043" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect((await api(page, "/favorites")).body.data).toEqual([]);
});
test("12. nft.updated reflete preço e disponibilidade na Lista de interesse", async ({
  page,
}) => {
  await login(page);
  await api(page, "/favorites", { method: "POST", body: { nftId: "nft-002" } });
  await page.goto("/account/favorites");
  const card = page.locator(".account-favorites .nft-card");
  await expect(card).toContainText("1.69 ETH");
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-002", "edition-2-limited", {
      priceEth: "0.99",
    }),
  );
  await expect(card).toContainText("0.99 ETH");
});
test("13. teclado: menu da conta, mostrar senha e coração", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page, ada, "/account/profile");
  if (mobile) {
    const toggle = page.locator(".account-disclosure");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/account\/wallets$/);
    await expect(toggle).toBeFocused();
  } else {
    const link = page
      .getByRole("navigation", { name: "Meu perfil" })
      .getByRole("link", { name: "Carteiras" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/account\/wallets$/);
  }
  await page.goto("/account/profile");
  const reveal = page.getByRole("button", { name: "Mostrar senha atual" });
  await reveal.focus();
  await page.keyboard.press("Space");
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Senha atual", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.goto("/");
  const heart = page.getByRole("button", {
    name: "Favoritar Emerald Ape #042",
  });
  await heart.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remover Emerald Ape #042 dos favoritos",
    }),
  ).toBeFocused();
});
// A separate session of `credentials`, outside the page's identity.
async function sessionToken(page: Page, credentials: typeof ada) {
  const { body } = await api(page, "/session/login", {
    method: "POST",
    body: credentials,
    token: null,
  });
  return (body.data?.token ?? body.token) as string;
}
// In-app user switch (no reload, so queued work keeps running): sign out and
// sign in as `credentials` through the login dialog.
async function switchUser(
  page: Page,
  mobile: boolean,
  credentials: typeof ada,
) {
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  const email = dialog(page).getByRole("textbox", { name: "E-mail" });
  if (!(await email.isVisible())) {
    if (mobile)
      await page.getByRole("link", { name: "Minha conta, entrar" }).click();
    else await page.getByRole("link", { name: "Entrar" }).click();
  }
  await fillLogin(page, credentials);
  await page.waitForFunction(
    (email) => window.__KURIO_TEST__.identity().session?.user.email === email,
    credentials.email,
  );
}
// Two animation frames: work queued behind a response (promise callbacks)
// has run by then.
const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
// Private mutations sent by the page, by method and path.
function recordWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && request.method() !== "GET")
      writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}
test("14. troca de usuário com favoritos na fila: nada é enviado como o novo usuário", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await page.goto("/");
  await expect(firstCard(page)).toBeVisible();
  const writes = recordWrites(page);
  await page.evaluate(() => window.__KURIO_TEST__.favoriteDelay(1500));
  // Ada: favorite (in flight), unfavorite, favorite (queued behind it).
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '.nft-card button.favorite[aria-label*="Emerald Ape #042"]',
    )!;
    for (let i = 0; i < 3; i++) button.click();
  });
  const first = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/favorites"),
  );
  // Lin signs in while Ada's first request is still in flight (signing out
  // revokes Ada's session, so that request is refused).
  await switchUser(page, mobile, lin);
  await first;
  // The queued intent would be sent right after the first response.
  await frames(page);
  expect(writes.filter((w) => w.includes("/favorites"))).toEqual([
    "POST /api/favorites",
  ]);
  expect((await api(page, "/favorites")).body.data).toEqual([]);
});
test("15. troca de usuário durante o Salvar do perfil: avatar e senha não vão para a outra conta", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page, ada, "/account/profile");
  const writes = recordWrites(page);
  await page.getByLabel("Nome de exibição").fill("Ada Lenta");
  await page.locator("#profile-avatar").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: await image(page, 300, 300, "image/png"),
  });
  await page.getByLabel("Senha atual", { exact: true }).fill(ada.password);
  await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha2026");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("NovaSenha2026");
  await page.evaluate(() => window.__KURIO_TEST__.profileDelay(1500));
  const data = page.waitForResponse(
    (r) => r.request().method() === "PATCH" && r.url().endsWith("/profile"),
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await switchUser(page, mobile, lin);
  await data;
  await page.evaluate(() => window.__KURIO_TEST__.profileDelay(0));
  await frames(page);
  // Only the step already in flight was sent; avatar and password stopped.
  expect(writes.filter((w) => w.includes("/profile"))).toEqual([
    "PATCH /api/profile",
  ]);
  const linProfile = (await api(page, "/profile")).body.data;
  expect(linProfile.displayName).not.toBe("Ada Lenta");
  expect(linProfile.avatar).toBeNull();
  // Lin's password is unchanged.
  expect(await sessionToken(page, lin)).toBeTruthy();
});
test("16. falha de rede nos dados do perfil preserva o que foi digitado", async ({
  page,
}) => {
  await login(page, lin, "/account/profile");
  await page.getByLabel("Nome de exibição").fill("Lin Rede");
  await page.locator("#profile-avatar").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: await image(page, 300, 300, "image/png"),
  });
  await expect(
    page.getByRole("img", { name: "Prévia do novo avatar" }),
  ).toBeVisible();
  // The next request (the data step) fails without field errors; the avatar
  // step succeeds after it.
  await page.evaluate(() => window.__KURIO_TEST__.failNext("network"));
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(status(page)).toContainText("Avatar: salvo.");
  await expect(page.getByLabel("Nome de exibição")).toHaveValue("Lin Rede");
  expect((await api(page, "/profile")).body.data.displayName).not.toBe(
    "Lin Rede",
  );
});
