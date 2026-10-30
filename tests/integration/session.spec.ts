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
const dialog = (page: Page) => page.getByRole("dialog");
async function ready(page: Page) {
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
}
async function fillLogin(page: Page, credentials: typeof ada) {
  await dialog(page)
    .getByRole("textbox", { name: "E-mail" })
    .fill(credentials.email);
  await dialog(page)
    .getByLabel("Senha", { exact: true })
    .fill(credentials.password);
  await dialog(page)
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
}
async function loginAt(page: Page, path: string, credentials = ada) {
  await page.goto(`/login?redirect=${encodeURIComponent(path)}`);
  await ready(page);
  await fillLogin(page, credentials);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
}
const identity = (page: Page) =>
  page.evaluate(() => window.__KURIO_TEST__.identity());
// Adds lines through the real cart API for whoever the page currently is
// (signed-in user or visitor), the same way the client does.
async function addLines(page: Page, lines: Line[]) {
  await page.evaluate(async (lines) => {
    const h = window.__KURIO_TEST__;
    let headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const current = h.identity();
    if (current.sessionToken)
      headers = { ...headers, Authorization: `Bearer ${current.sessionToken}` };
    else {
      let token = localStorage.getItem("kurio.visitor.v1");
      if (!token) {
        const r = await fetch("/api/visitor-sessions", { method: "POST" });
        token = ((await r.json()) as { data: { token: string } }).data.token;
        localStorage.setItem("kurio.visitor.v1", token);
      }
      headers = { ...headers, "X-Visitor-Token": token };
    }
    for (const [nftId, editionId, quantity] of lines) {
      const r = await fetch("/api/cart/items", {
        method: "POST",
        headers,
        body: JSON.stringify({ nftId, editionId, quantity }),
      });
      if (!r.ok) throw new Error(await r.text());
    }
  }, lines);
}
// Radix routes Escape to the top layer only after that layer's effects ran;
// focus inside the notice marks that point.
const noticeReady = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const dialogs = document.querySelectorAll("[role=dialog]");
        return Boolean(
          dialogs[dialogs.length - 1]?.contains(document.activeElement),
        );
      }),
    )
    .toBe(true);
const cartRows = (page: Page) => page.locator(".cart-table tbody tr");
const isMobile = (name: string) => name.includes("mobile");
// Ada's fixture profile has a display name, which the header shows.
const adaAccount = "Conta de Ada Example";
// The auth route is lazy: wait for its dialog before driving it by keyboard.
const authReady = (page: Page) =>
  expect(dialog(page).getByRole("textbox", { name: "E-mail" })).toBeFocused();
// The mobile cart screen has its own header and no bottom navigation (its
// "Voltar" goes back in history), so account actions start from the catalog.
async function leaveMobileCart(page: Page) {
  await page.goto("/");
  await ready(page);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status !== "checking",
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});
test("cadastro valida por campo, recusa duplicados com 409 e autentica voltando ao destino", async ({
  page,
}) => {
  await page.goto("/signup?redirect=%2Fcart");
  await ready(page);
  const form = dialog(page);
  // Rules are visible before any error.
  await expect(form).toContainText("De 3 a 20 caracteres");
  await expect(form).toContainText("Mínimo de 8 caracteres");
  await form.locator(".auth-submit").click();
  await expect(
    form.getByRole("textbox", { name: "Nome de usuário" }),
  ).toBeFocused();
  await expect(
    form.getByRole("textbox", { name: "Nome de usuário" }),
  ).toHaveAttribute("aria-invalid", "true");
  await form
    .getByRole("textbox", { name: "Nome de usuário" })
    .fill("Ada_Example");
  await form.getByRole("textbox", { name: "E-mail" }).fill("ADA@example.test");
  await form.getByLabel("Senha", { exact: true }).fill("Segredo123");
  await form.getByLabel("Confirmar senha", { exact: true }).fill("Outro123");
  await form.locator(".auth-submit").click();
  await expect(form.locator("#auth-confirm-error")).toHaveText(
    "As senhas não coincidem.",
  );
  await form.getByLabel("Confirmar senha", { exact: true }).fill("Segredo123");
  await form.locator(".auth-submit").click();
  // Duplicates (case-insensitive) come back as 409 on the matching fields.
  await expect(form.locator("#auth-username-error")).toHaveText(
    "Este nome de usuário já está em uso.",
  );
  await expect(form.locator("#auth-email-error")).toHaveText(
    "Este e-mail já está cadastrado.",
  );
  await expect(
    form.getByRole("textbox", { name: "Nome de usuário" }),
  ).toBeFocused();
  await form
    .getByRole("textbox", { name: "Nome de usuário" })
    .fill("nova_colecao");
  await form.getByRole("textbox", { name: "E-mail" }).fill("nova@example.test");
  await form.locator(".auth-submit").click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator(".notices")).toContainText(
    "Conta criada. Você entrou como nova_colecao.",
  );
  expect((await identity(page)).session?.user).toMatchObject({
    username: "nova_colecao",
    email: "nova@example.test",
    displayName: null,
  });
});
test("login inválido tem mensagem genérica; credenciais fictícias entram", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await ready(page);
  await fillLogin(page, {
    email: "ninguem@example.test",
    password: "Qualquer1",
  });
  await expect(dialog(page).locator(".auth-summary")).toHaveText(
    "E-mail ou senha incorretos.",
  );
  await fillLogin(page, { email: ada.email, password: "SenhaErrada1" });
  await expect(dialog(page).locator(".auth-summary")).toHaveText(
    "E-mail ou senha incorretos.",
  );
  // Typed values are kept after a failure.
  await expect(
    dialog(page).getByRole("textbox", { name: "E-mail" }),
  ).toHaveValue(ada.email);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/$|\/\?/);
  if (isMobile(testInfo.project.name))
    await expect(
      page.getByRole("button", { name: "Minha conta" }),
    ).toBeVisible();
  else
    await expect(page.getByRole("button", { name: adaAccount })).toBeVisible();
});
test("refresh mantém a sessão e /login autenticado vai ao destino", async ({
  page,
}) => {
  await loginAt(page, "/cart");
  await page.reload();
  await ready(page);
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
  expect((await identity(page)).session?.user.username).toBe("ada_example");
  await page.goto("/login?redirect=%2Fcart");
  await expect(page).toHaveURL(/\/cart$/);
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/$|\/\?/);
});
test("logout revoga o token e volta ao carrinho de visitante vazio", async ({
  page,
}, testInfo) => {
  await loginAt(page, "/cart");
  await addLines(page, [["nft-001", "edition-1-limited", 2]]);
  await page.reload();
  await ready(page);
  await expect(cartRows(page)).toHaveCount(1);
  const oldToken = (await identity(page)).sessionToken!;
  const mobile = isMobile(testInfo.project.name);
  if (mobile) {
    await leaveMobileCart(page);
    await page.getByRole("button", { name: "Minha conta" }).click();
    await dialog(page).getByRole("button", { name: "Sair" }).click();
  } else {
    await page.getByRole("button", { name: adaAccount }).click();
    await page.getByRole("button", { name: "Sair" }).click();
  }
  await expect(page.locator(".notices")).toContainText(
    "Você saiu da sua conta.",
  );
  if (mobile) await page.locator(".mobile-nav .cart-link").click();
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  expect((await identity(page)).status).toBe("anonymous");
  const status = await page.evaluate(async (token) => {
    const r = await fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: r.status, body: await r.json() };
  }, oldToken);
  expect(status.status).toBe(401);
  expect(status.body.error.code).toBe("SESSION_INVALID");
});
test("troca de usuário A → B nunca exibe dados de A", async ({
  page,
}, testInfo) => {
  await loginAt(page, "/cart");
  await addLines(page, [["nft-001", "edition-1-limited", 2]]);
  await page.reload();
  await ready(page);
  await expect(cartRows(page)).toHaveCount(1);
  const mobile = isMobile(testInfo.project.name);
  if (mobile) {
    await leaveMobileCart(page);
    // Ada's cart badge must settle before recording starts.
    await expect(page.locator(".mobile-nav .cart-link")).toHaveAttribute(
      "aria-label",
      /2 itens/,
    );
  }
  // From the switch on, record every cart label and row the page renders.
  // The switch happens in-app (no reload), so the recorder keeps running.
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { __seen: seen });
    const capture = () =>
      document
        .querySelectorAll(".cart-link, .cart-table tbody tr")
        .forEach((el) =>
          seen.push(el.getAttribute("aria-label") ?? el.textContent ?? ""),
        );
    new MutationObserver(capture).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  });
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  if (mobile) {
    await page.getByRole("link", { name: "Minha conta, entrar" }).click();
  } else await page.getByRole("link", { name: "Entrar" }).click();
  await fillLogin(page, lin);
  if (mobile) {
    await expect(page).toHaveURL(/\/$|\/\?/);
    await page.locator(".mobile-nav .cart-link").click();
  }
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  expect((await identity(page)).session?.user.username).toBe("lin_example");
  const seen = await page.evaluate(
    () => (window as unknown as { __seen: string[] }).__seen,
  );
  // Until React commits the sign-out, unrelated mutations can still snapshot
  // A's cart. Once the cart is cleared, A's data must never come back.
  const cleared = seen.indexOf("Carrinho, vazio");
  expect(cleared).toBeGreaterThanOrEqual(0);
  const after = seen.slice(cleared).join(" ");
  expect(after).not.toContain("Emerald");
  expect(after).not.toContain("2 itens");
});
test("mesclagem soma, acrescenta, marca conflito, aplica a regra do cupom e não duplica", async ({
  page,
}) => {
  // Ada's account cart: 4 × nft-001 limited and the LANCAMENTO coupon.
  await loginAt(page, "/");
  await addLines(page, [["nft-001", "edition-1-limited", 4]]);
  await page.evaluate(async () => {
    const token = window.__KURIO_TEST__.identity().sessionToken;
    await fetch("/api/cart/coupon", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: "LANCAMENTO" }),
    });
  });
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  // Visitor cart: 3 × the same edition, a new edition and KURIO10.
  await addLines(page, [
    ["nft-001", "edition-1-limited", 3],
    ["nft-003", "edition-3-limited", 1],
  ]);
  const visitorToken = await page.evaluate(() =>
    localStorage.getItem("kurio.visitor.v1"),
  );
  await page.evaluate(async (token) => {
    await fetch("/api/cart/coupon", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "X-Visitor-Token": token!,
      },
      body: JSON.stringify({ code: "KURIO10" }),
    });
  }, visitorToken);
  await page.reload();
  await ready(page);
  await loginAt(page, "/cart");
  await expect(page.locator(".notices")).toContainText(
    "2 linhas do carrinho de visitante foram juntadas ao seu carrinho. 1 linha precisa de ajuste no carrinho.",
  );
  const emerald = cartRows(page).filter({ hasText: "Emerald Ape #042" });
  // 4 + 3 = 7 exceeds the limit of 5: kept, flagged, never reduced silently.
  await expect(emerald.locator(".qty-value")).toHaveText("7");
  await expect(emerald.locator(".cart-notice")).toContainText(
    "Disponível no máximo 5.",
  );
  await expect(cartRows(page)).toHaveCount(2);
  await expect(page.locator("#coupon-applied")).toContainText("KURIO10");
  // Repeating the login with the consumed visitor token duplicates nothing.
  const repeat = await page.evaluate(
    async ({ token, ada }) => {
      const r = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Visitor-Token": token!,
        },
        body: JSON.stringify(ada),
      });
      const body = await r.json();
      const cart = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${body.data.token}` },
      });
      return { merge: body.data.merge, cart: (await cart.json()).data };
    },
    { token: visitorToken, ada },
  );
  expect(repeat.merge).toBeNull();
  expect(repeat.cart.items).toHaveLength(2);
  expect(repeat.cart.itemCount).toBe(8);
});
test("retorno ao fluxo: do carrinho e do catálogo com filtros, search e hash", async ({
  page,
}, testInfo) => {
  await addLines(page, [["nft-001", "edition-1-limited", 1]]);
  await page.goto("/cart");
  await ready(page);
  // From the cart, the login continues to the checkout.
  await page.getByRole("link", { name: "Conectar e finalizar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/checkout/);
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  await page.goto("/?category=art&sort=price-desc#catalogo");
  await ready(page);
  if (isMobile(testInfo.project.name))
    await page.getByRole("link", { name: "Minha conta, entrar" }).click();
  else await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/category=art/);
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page).toHaveURL(/#catalogo$/);
});
test("o login abre sobre a página atual, que continua igual atrás do diálogo", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  const opener = mobile
    ? page.getByRole("link", { name: "Minha conta, entrar" })
    : page.getByRole("link", { name: "Entrar" });
  await page.goto("/?sort=price-desc&page=2");
  await ready(page);
  await expect(page.locator(".nft-card").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForFunction(() => window.scrollY === 900);
  // A marker on the live page: it only survives if the page is not remounted.
  await page.evaluate(() => {
    document.querySelector(".nft-card")!.setAttribute("data-marker", "1");
  });
  const scroll = await page.evaluate(() => window.scrollY);
  await opener.click();
  await authReady(page);
  await expect(page).toHaveURL(/\/login\?redirect=%2F%3F.*sort%3Dprice-desc/);
  await expect(page.locator(".nft-card[data-marker]")).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  // Switching to signup and back keeps the same page behind.
  // Desktop shows the tabs; mobile shows the footer switch link instead.
  await dialog(page)
    .getByRole("link", { name: mobile ? "Crie uma conta" : "Criar conta" })
    .click();
  await expect(page).toHaveURL(/\/signup\?redirect=/);
  await expect(page.locator(".nft-card[data-marker]")).toHaveCount(1);
  await dialog(page)
    .getByRole("link", { name: mobile ? "Entre" : "Entrar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  if (mobile) await page.getByRole("button", { name: "Voltar" }).click();
  else await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/\?.*sort=price-desc.*page=2/);
  await expect(page.locator(".nft-card[data-marker]")).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  // Logging in from the cart keeps the cart behind and continues to the
  // checkout.
  await addLines(page, [["nft-001", "edition-1-limited", 1]]);
  await page.goto("/cart");
  await ready(page);
  await page.getByRole("link", { name: "Conectar e finalizar" }).click();
  await authReady(page);
  await expect(cartRows(page)).toHaveCount(1);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/checkout/);
  // Going back does not reopen the login.
  await page.goBack();
  await expect(dialog(page)).toHaveCount(0);
});
test("depois de recarregar com o diálogo aberto, fechar mantém a página no topo", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  // Mobile detail has its own header without "Minha conta".
  for (const start of [
    mobile ? "/" : "/nfts/nft-001",
    "/?sort=price-desc#catalogo",
  ]) {
    await page.goto(start);
    await ready(page);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => window.scrollY === 600);
    await (
      mobile
        ? page.getByRole("link", { name: "Minha conta, entrar" })
        : page.getByRole("link", { name: "Entrar" })
    ).click();
    await authReady(page);
    await page.reload();
    await ready(page);
    await authReady(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (mobile) await page.getByRole("button", { name: "Voltar" }).click();
    else await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    // Neither the browser's restoration of the old position nor the hash
    // may scroll the refreshed page once the dialog closes.
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});
test("recarregar no mobile não mostra a página antes do diálogo; a primeira abertura é imediata", async ({
  page,
}, testInfo) => {
  test.skip(
    !isMobile(testInfo.project.name),
    "cobertura de tela cheia é do mobile",
  );
  const opener = page.getByRole("link", { name: "Minha conta, entrar" });
  await opener.click();
  await authReady(page);
  // Every frame from the first paint: the page may only appear covered by
  // the full-screen dialog (or the cover that precedes it).
  await page.addInitScript(() => {
    const frames: boolean[] = [];
    Object.assign(window, { __uncovered: frames });
    const tick = () => {
      const page = !!document.querySelector("main");
      const covered =
        !!document.querySelector(".auth-dialog, .auth-pending") ||
        (document.documentElement.classList.contains("auth-restoring") &&
          getComputedStyle(document.body, "::after").position === "fixed");
      frames.push(page && !covered);
      if (frames.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.reload();
  await authReady(page);
  const uncovered = await page.evaluate(
    () => (window as unknown as { __uncovered: boolean[] }).__uncovered,
  );
  expect(uncovered.filter(Boolean)).toHaveLength(0);
  // A fresh load prefetches the dialog: the first opening renders it
  // directly, never through the loading fallback.
  await page.goto("/");
  await ready(page);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const seen = { fallback: false };
    Object.assign(window, { __fallback: seen });
    new MutationObserver(() => {
      if (document.querySelector(".auth-pending")) seen.fallback = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await opener.click();
  await authReady(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __fallback: { fallback: boolean } }).__fallback
          .fallback,
    ),
  ).toBe(false);
});
// `/__private` exists only in the integration build and is protected by
// `requireSession`, the guard the checkout will use.
const privateHeading = (page: Page) =>
  page.getByRole("heading", { name: "Área privada de teste" });
test("guarda de rota privada: sessão válida segue; sem sessão vai ao login com o destino", async ({
  page,
}) => {
  await page.goto("/__private");
  await expect(page).toHaveURL(/\/login\?redirect=%2F__private$/);
  await authReady(page);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/__private$/);
  await expect(privateHeading(page)).toBeVisible();
  // A stored, valid session after a reload also goes straight in.
  await page.reload();
  await expect(privateHeading(page)).toBeVisible();
});
test("guarda de rota privada: falha transitória na verificação não desloga e permite nova tentativa", async ({
  page,
}) => {
  await loginAt(page, "/");
  const token = (await identity(page)).sessionToken;
  // The first check after the next load fails with a 503 (then network).
  for (const kind of ["http", "network"] as const) {
    await page.evaluate(
      (kind) => window.__KURIO_TEST__.failSessionChecks(kind, 1),
      kind,
    );
    await page.goto("/__private");
    const alert = page.getByRole("alert").filter({
      hasText: "Não foi possível confirmar sua sessão",
    });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/__private$/);
    expect(await identity(page)).toMatchObject({
      status: "checking",
      sessionToken: token,
    });
    await alert.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(privateHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/\/__private$/);
  }
  // The login under a transient failure renders normally (no redirect, no
  // sign-out), and the token is kept.
  await page.evaluate(() => window.__KURIO_TEST__.failSessionChecks("http", 1));
  await page.goto("/login?redirect=%2F__private");
  await authReady(page);
  await expect(page).toHaveURL(/\/login\?redirect=%2F__private$/);
  expect((await identity(page)).sessionToken).toBe(token);
});
test("guarda de rota privada: sessão guardada inválida (401) vai ao login", async ({
  page,
}) => {
  await loginAt(page, "/");
  await page.evaluate(() => window.__KURIO_TEST__.revokeSession());
  await page.goto("/__private");
  await expect(page).toHaveURL(/\/login\?redirect=%2F__private$/);
  expect((await identity(page)).status).toBe("anonymous");
});
test("redirecionamento aberto é rejeitado", async ({ page }) => {
  for (const target of [
    "https://evil.example/roubo",
    "//evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
    "/admin",
    "/login",
  ]) {
    await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
    await ready(page);
    await authReady(page);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/(\?.*)?$/);
  }
  await page.goto(`/login?redirect=${encodeURIComponent("//evil.example")}`);
  await ready(page);
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/(\?.*)?$/);
});
test("expiração durante a navegação: aviso, login e retorno com o carrinho do usuário", async ({
  page,
}) => {
  await loginAt(page, "/cart");
  await addLines(page, [["nft-001", "edition-1-limited", 2]]);
  await page.reload();
  await ready(page);
  await expect(cartRows(page)).toHaveCount(1);
  await page.evaluate(() => window.__KURIO_TEST__.expireSession());
  // The next private request answers 401 SESSION_INVALID. Expiring writes the
  // simulated server's storage, which can already trigger a cart refetch; the
  // click only guarantees a private request when that has not happened yet.
  await cartRows(page)
    .first()
    .getByRole("button", { name: /Aumentar quantidade/ })
    .click({ timeout: 2000 })
    .catch(() => {});
  await expect(page.locator(".notices")).toContainText(
    "Sua sessão expirou. Entre novamente para continuar.",
  );
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcart$/);
  // The public context still works without a session.
  expect((await identity(page)).status).toBe("anonymous");
  await fillLogin(page, ada);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(cartRows(page)).toHaveCount(1);
  await expect(cartRows(page).locator(".qty-value")).toHaveText("2");
});
test("resposta tardia da sessão anterior não altera a sessão atual", async ({
  page,
}) => {
  await loginAt(page, "/cart");
  await addLines(page, [["nft-001", "edition-1-limited", 2]]);
  await page.reload();
  await ready(page);
  await expect(cartRows(page)).toHaveCount(1);
  const abortedBefore = await page.evaluate(
    () => window.__KURIO_TEST__.state().transport.aborted,
  );
  // A slow cart read for Ada is in flight when the session ends.
  await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    h.cartDelay("read", 800);
    await h.update("nft-001", "edition-1-limited", { available: 9 });
  });
  await page.waitForFunction(
    () => window.__KURIO_TEST__.cartQuery().fetchStatus === "fetching",
  );
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  // Observed condition: the old request was cancelled, not applied.
  await page.waitForFunction(
    (before) => window.__KURIO_TEST__.state().transport.aborted > before,
    abortedBefore,
  );
  await page.evaluate(() => window.__KURIO_TEST__.cartDelay("read", 0));
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  await expect(cartRows(page)).toHaveCount(0);
});
test("token de visitante desconhecido é tratado como visitante, com aviso", async ({
  page,
}) => {
  await addLines(page, [["nft-001", "edition-1-limited", 1]]);
  // Reset the simulated server but keep the client's visitor token.
  await page.evaluate(() => window.__KURIO_TEST__.reset());
  await page.goto("/cart");
  await ready(page);
  await expect(page.locator(".notices")).toContainText(
    "Seu carrinho anterior não está mais disponível.",
  );
  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible();
  await expect(page.locator(".notices")).not.toContainText("sessão expirou");
  expect(await identity(page)).toMatchObject({
    status: "anonymous",
    visitorToken: null,
  });
});
test("teclado e foco no login; ações sociais e recuperação informam indisponibilidade", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  const opener = mobile
    ? page.getByRole("link", { name: "Minha conta, entrar" })
    : page.getByRole("link", { name: "Entrar" });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(
    dialog(page).getByRole("textbox", { name: "E-mail" }),
  ).toBeFocused();
  // Focus stays inside the dialog.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("[role=dialog]")),
      ),
    ).toBe(true);
  }
  const reveal = dialog(page).getByRole("button", { name: "Mostrar senha" });
  await expect(reveal).toHaveAttribute("aria-pressed", "false");
  await reveal.click();
  await expect(reveal).toHaveAttribute("aria-pressed", "true");
  // Each notice is a nested dialog: Escape closes only it, and focus returns
  // to its trigger inside the login dialog.
  const forgot = dialog(page).getByRole("button", {
    name: "Esqueceu a senha?",
  });
  await forgot.click();
  await expect(page.getByRole("dialog").last()).toContainText(
    "recuperação de senha ainda não está disponível",
  );
  await noticeReady(page);
  await page.keyboard.press("Escape");
  await expect(forgot).toBeFocused();
  const google = dialog(page)
    .first()
    .getByRole("button", { name: "Continuar com Google" });
  await google.click();
  await expect(page.getByRole("dialog").last()).toContainText(
    "login social ainda não está disponível",
  );
  await noticeReady(page);
  await page.keyboard.press("Escape");
  await expect(google).toBeFocused();
  if (mobile) {
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/$|\/\?/);
  } else {
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$|\/\?/);
    await expect(opener).toBeFocused();
  }
});
test("nenhuma senha em claro no armazenamento, no estado simulado ou nas respostas", async ({
  page,
}) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/"))
      bodies.push(await response.text().catch(() => ""));
  });
  await page.goto("/signup");
  await ready(page);
  const form = dialog(page);
  await form
    .getByRole("textbox", { name: "Nome de usuário" })
    .fill("segredo_test");
  await form
    .getByRole("textbox", { name: "E-mail" })
    .fill("segredo@example.test");
  await form.getByLabel("Senha", { exact: true }).fill("Segredo123");
  await form.getByLabel("Confirmar senha", { exact: true }).fill("Segredo123");
  await form.locator(".auth-submit").click();
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
  await page.evaluate(() => window.__KURIO_TEST__.signOut());
  await loginAt(page, "/", {
    email: "segredo@example.test",
    password: "Segredo123",
  });
  const stored = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    snapshot: JSON.stringify(window.__KURIO_TEST__.snapshot()),
  }));
  for (const text of [stored.local, stored.snapshot, ...bodies]) {
    expect(text).not.toContain("Segredo123");
    expect(text).not.toContain("AdaKurio2026");
  }
  expect(stored.snapshot).toContain("PBKDF2-SHA256");
});
