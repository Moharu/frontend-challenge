import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Harness } from "../../src/testing/harness";
declare global {
  interface Window {
    __KURIO_TEST__: Harness;
  }
}
// Automated accessibility audit (axe, WCAG 2.1 A/AA rules, contrast included)
// of every route and main state, desktop, tablet and mobile.
const excluded: string[] = [];
const ada = { email: "ada@example.test", password: "AdaKurio2026" };
const isMobile = (name: string) => name.includes("mobile");
async function ready(page: Page) {
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
}
async function audit(page: Page, state: string) {
  const { violations, incomplete } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .disableRules(excluded)
    .analyze();
  const found = violations.map(
    (v) =>
      `${state}: ${v.id} (${v.impact}) ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  // Text axe cannot judge (over images, gradients, overlapping layers) is
  // measured from pixels.
  for (const v of incomplete.filter((v) => v.id === "color-contrast"))
    for (const node of v.nodes) {
      const data = node.any[0]?.data as { messageKey?: string } | undefined;
      if (data?.messageKey === "nonBmp") continue; // icon glyphs, not text
      const ratio = await measuredContrast(page, node.target.join(" "));
      if (process.env.A11Y_PROBE)
        console.log(
          `PROBE ${state} | ${node.target.join(" ")} | ${ratio?.value.toFixed(2)} / ${ratio?.required}`,
        );
      if (ratio && ratio.value < ratio.required)
        found.push(
          `${state}: color-contrast (medido) ${node.target.join(" ")} ${ratio.value.toFixed(2)}:1 < ${ratio.required}:1`,
        );
    }
  if (!process.env.A11Y_PROBE) expect(found, state).toEqual([]);
}
// Contrast of an element's text against what is actually painted behind it:
// the element is captured with its text made transparent, and the text color
// is compared with each background pixel. The result is the ratio that 95% of
// the background pixels reach (isolated specks of an artwork do not decide).
async function measuredContrast(page: Page, selector: string) {
  const el = page.locator(selector).first();
  if (!(await el.isVisible())) return null;
  // Controls named only by an icon have no text to measure.
  if (!(await el.evaluate((e) => !!e.textContent?.trim()))) return null;
  // Content a modal dialog covers is inert and is not read or operated.
  if (await el.evaluate((e) => !!e.closest("[aria-hidden=true], [inert]")))
    return null;
  // Centered, so fixed bars do not cover it in the capture.
  await el.evaluate((e) =>
    // Instant: a smooth carousel scroll would be captured mid-way, with the
    // text passing under the carousel's arrow buttons.
    e.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "instant",
    }),
  );
  // Text covered by another layer (an open menu over the page) is not seen.
  const covered = await el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const top = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return !!top && !e.contains(top) && !top.contains(e);
  });
  if (covered) return null;
  const style = await el.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      color: s.color,
      size: parseFloat(s.fontSize),
      bold: Number(s.fontWeight) >= 700,
    };
  });
  const large = style.size >= 24 || (style.bold && style.size >= 18.66);
  const required = large ? 3 : 4.5;
  await el.evaluate((e) => e.setAttribute("data-contrast-probe", ""));
  const hide = await page.addStyleTag({
    content:
      "[data-contrast-probe], [data-contrast-probe] * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }" +
      // The fade at a carousel's edge only hints that it scrolls; the card
      // under it is read once scrolled into the clear part.
      " * { mask-image: none !important; -webkit-mask-image: none !important; }",
  });
  // Only the area of the text itself: borders and padding are not behind it.
  const clip = await el.evaluate((e) => {
    // Union of the text nodes only: icons next to the text are not behind it.
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    const r = {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    };
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const b = range.getBoundingClientRect();
      if (!b.width) continue;
      r.left = Math.min(r.left, b.left);
      r.top = Math.min(r.top, b.top);
      r.right = Math.max(r.right, b.right);
      r.bottom = Math.max(r.bottom, b.bottom);
    }
    // The visible part, within the viewport and any clipping scroller.
    let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
    for (let p: Element | null = e; p; p = p.parentElement) {
      if (getComputedStyle(p).overflow === "visible") continue;
      const c = p.getBoundingClientRect();
      [left, top] = [Math.max(left, c.left), Math.max(top, c.top)];
      [right, bottom] = [Math.min(right, c.right), Math.min(bottom, c.bottom)];
    }
    left = Math.max(left, 0);
    top = Math.max(top, 0);
    right = Math.min(right, innerWidth);
    bottom = Math.min(bottom, innerHeight);
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
  if (clip.width < 1 || clip.height < 1) return null;
  const png = await page.screenshot({ clip, animations: "disabled" });
  await hide.evaluate((s) => (s as HTMLStyleElement).remove());
  await el.evaluate((e) => e.removeAttribute("data-contrast-probe"));
  const value = await page.evaluate(
    async ({ src, color }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, img.width, img.height).data;
      const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
      const lin = (c: number) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratios: number[] = [];
      for (let i = 0; i < px.length; i += 4) {
        const [br, bg, bb] = [px[i], px[i + 1], px[i + 2]];
        // Semi-transparent text is blended over the pixel behind it.
        const fg = lum(
          r * a + br * (1 - a),
          g * a + bg * (1 - a),
          b * a + bb * (1 - a),
        );
        const back = lum(br, bg, bb);
        ratios.push((Math.max(fg, back) + 0.05) / (Math.min(fg, back) + 0.05));
      }
      ratios.sort((x, y) => x - y);
      return ratios[Math.floor(ratios.length * 0.05)];
    },
    {
      src: `data:image/png;base64,${png.toString("base64")}`,
      color: style.color,
    },
  );
  return { value, required };
}
async function login(page: Page) {
  await page.goto("/login?redirect=%2F");
  await ready(page);
  const form = page.getByRole("dialog");
  await expect(form.getByRole("textbox", { name: "E-mail" })).toBeFocused();
  await form.getByRole("textbox", { name: "E-mail" }).fill(ada.email);
  await form.getByLabel("Senha", { exact: true }).fill(ada.password);
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
}
async function addEmerald(page: Page) {
  const status = await page.evaluate(async () => {
    const token = window.__KURIO_TEST__.identity().sessionToken;
    const r = await fetch("/api/cart/items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nftId: "nft-001",
        editionId: "edition-1-limited",
        quantity: 1,
      }),
    });
    return r.status;
  });
  expect(status).toBe(200);
}
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
async function checkoutReady(page: Page, step?: string) {
  await page.goto(step ? `/checkout?step=${step}` : "/checkout");
  await ready(page);
  await expect(page.locator(".checkout-page")).toBeVisible();
  if (step === undefined || step === "revisao")
    await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
}
test("visitante: catálogo, filtros, detalhe, carrinho vazio, login, cadastro e página inexistente", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await audit(page, "catálogo");
  if (isMobile(testInfo.project.name)) {
    await page.getByRole("button", { name: "Abrir filtros" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page, "drawer de filtros");
    await page.keyboard.press("Escape");
  }
  await page.goto("/?network=solana&search=zzz");
  await expect(page.getByText(/Nenhum NFT/i).first()).toBeVisible();
  await audit(page, "catálogo vazio");
  await page.goto("/nfts/nft-001");
  await expect(heading(page)).toHaveText("Emerald Ape #042");
  await audit(page, "detalhe");
  await page.goto("/cart");
  await expect(page.locator("#main")).toContainText("Carrinho");
  await audit(page, "carrinho vazio");
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "E-mail" }),
    ).toBeVisible();
    await audit(page, path);
  }
  // Validation errors associated with their fields.
  await page.getByRole("dialog").locator('button[type="submit"]').click();
  await expect(
    page.getByRole("dialog").locator("[aria-invalid=true]").first(),
  ).toBeVisible();
  await audit(page, "cadastro com erros");
  await page.goto("/rota-que-nao-existe");
  await expect(heading(page)).toHaveText("Página não encontrada");
  await audit(page, "não encontrada");
});
test("colecionador: carrinho, checkout, pedido pendente, confirmado e recusado", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  await login(page);
  await addEmerald(page);
  await page.goto("/cart");
  await expect(
    page.locator(".cart-table, .cart-list, .cart-items").first(),
  ).toBeVisible();
  await audit(page, "carrinho com itens");
  if (mobile) {
    for (const step of ["dados", "carteira", "revisao"]) {
      await checkoutReady(page, step);
      await audit(page, `checkout ${step}`);
    }
  } else {
    await checkoutReady(page);
    await audit(page, "checkout");
    // Errors associated with the fields.
    await page
      .locator(".checkout-fields")
      .getByLabel("E-mail", { exact: false })
      .fill("invalido");
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page.locator("[aria-invalid=true]").first()).toBeVisible();
    await audit(page, "checkout com erros");
    await page
      .locator(".checkout-fields")
      .getByLabel("E-mail", { exact: false })
      .fill(ada.email);
  }
  for (const outcome of [
    { status: "confirmed" },
    { status: "declined", reason: "Saldo insuficiente na carteira." },
  ] as const) {
    if (outcome.status === "declined") await addEmerald(page);
    await page.evaluate(
      (outcome) => window.__KURIO_TEST__.setPayment(outcome, 3600000),
      outcome,
    );
    await checkoutReady(page, mobile ? "revisao" : undefined);
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    await expect(page).toHaveURL(/\/orders\/order-\d+$/);
    await expect(heading(page)).toHaveText("Aguardando confirmação da rede");
    await audit(page, `pedido pendente (${outcome.status})`);
    await page.evaluate(() => window.__KURIO_TEST__.resolvePayments());
    await expect(heading(page)).toHaveText(
      outcome.status === "confirmed"
        ? "Seus NFTs agora estão na sua carteira"
        : "Pagamento recusado",
    );
    await audit(page, `pedido ${outcome.status}`);
  }
});
test("conta: perfil, carteiras, Lista de interesse e seções indisponíveis", async ({
  page,
}, testInfo) => {
  await login(page);
  for (const path of [
    "/account/profile",
    "/account/wallets",
    "/account/favorites",
    "/account/activity",
    "/account/offers",
    "/account/downloads",
    "/account/support",
  ]) {
    await page.goto(path);
    await expect(heading(page)).toBeVisible();
    await expect(page.locator(".account-content")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    await audit(page, path);
  }
  if (isMobile(testInfo.project.name)) {
    await page.locator(".account-disclosure").click();
    await audit(page, "menu da conta aberto");
  }
});
// WCAG 1.4.10 (reflow): 320 CSS px wide, the equivalent of 1280 px at 400%
// zoom and stricter than 200%; nothing is cut and nothing scrolls sideways.
test("reflow a 320 px: sem rolagem horizontal nas rotas principais", async ({
  page,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "uma vez basta (largura fixa)");
  await page.setViewportSize({ width: 320, height: 640 });
  const noOverflow = async (state: string) => {
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const scrolledX = (el: Element) => {
        for (
          let p = el.parentElement;
          p && p !== document.body;
          p = p.parentElement
        )
          if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
        return false;
      };
      const wide = [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return (
            r.width > 0 &&
            r.right > width + 1 &&
            style.position !== "fixed" &&
            // Content of a horizontal scroller (carousels) is meant to
            // extend past the edge; the scroller itself must fit.
            !scrolledX(el)
          );
        })
        .slice(0, 3)
        .map((el) => el.className || el.tagName);
      return {
        scroll: document.documentElement.scrollWidth > width,
        wide,
      };
    });
    expect(overflow, state).toEqual({ scroll: false, wide: [] });
  };
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await noOverflow("catálogo");
  await page.goto("/nfts/nft-001");
  await expect(heading(page)).toBeVisible();
  await noOverflow("detalhe");
  await login(page);
  await addEmerald(page);
  for (const path of [
    "/cart",
    "/checkout?step=dados",
    "/checkout?step=carteira",
    "/checkout?step=revisao",
    "/account/profile",
    "/account/wallets",
  ]) {
    await page.goto(path);
    await expect(page.locator("#main")).toBeVisible();
    await expect(heading(page)).toBeVisible();
    await noOverflow(path);
  }
  // The fixed mobile bars fit the width.
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".mobile-nav, .site-header")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .every((r) => r.left >= 0 && r.right <= innerWidth + 1),
  );
  expect(bars).toBe(true);
});
test("movimento reduzido: shimmer, progresso do pedido e rolagem suave desligados", async ({
  page,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "o CSS é o mesmo nos dois perfis");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await ready(page);
  const styles = await page.evaluate(() => {
    const probe = (className: string) => {
      const el = document.createElement("div");
      el.className = className;
      document.body.append(el);
      const name = getComputedStyle(el).animationName;
      el.remove();
      return name;
    };
    return {
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      skeleton: probe("skeleton"),
    };
  });
  expect(styles).toEqual({ scroll: "auto", skeleton: "none" });
  const css = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .filter((r) => r instanceof CSSMediaRule)
      .filter((r) => r.conditionText.includes("prefers-reduced-motion"))
      .map((r) => r.cssText)
      .join("\n"),
  );
  // The order progress bar stops as well.
  expect(css).toMatch(/order-progress|progress/);
});
// Keyboard only: Tab moves forward until the control named `name` has focus
// (failing when it is never reached), checking on the way that every focused
// control shows a visible focus indicator.
async function tabTo(page: Page, name: RegExp, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const label =
        el.getAttribute("aria-label") ??
        (el.id
          ? document.querySelector(`label[for="${el.id}"]`)?.textContent
          : null) ??
        el.textContent ??
        "";
      return {
        label: label.trim().replace(/\s+/g, " "),
        visible:
          el.matches(":focus-visible") &&
          ((style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
            style.boxShadow !== "none"),
      };
    });
    if (!focused) continue;
    expect(focused.visible, `foco visível em "${focused.label}"`).toBe(true);
    if (name.test(focused.label)) return;
  }
  throw new Error(`"${name}" não foi alcançado pelo Tab`);
}
test("teclado: entrar, favoritar, comprar até o recibo, editar perfil e carteira", async ({
  page,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "roteiro de teclado no desktop");
  await page.goto("/login?redirect=%2F");
  await ready(page);
  // The dialog focuses the e-mail field.
  await page.keyboard.type(ada.email);
  await tabTo(page, /^Senha$/);
  await page.keyboard.type(ada.password);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => window.__KURIO_TEST__.identity().status === "authenticated",
  );
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
  await tabTo(page, /^Favoritar Emerald Ape #042$/);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remover Emerald Ape #042 dos favoritos",
    }),
  ).toBeFocused();
  // The card's link comes right before its heart.
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("link", { name: "Ver Emerald Ape #042", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading(page)).toHaveText("Emerald Ape #042");
  await tabTo(page, /^Comprar NFT$/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cart$/);
  await page.evaluate(() =>
    window.__KURIO_TEST__.setPayment({ status: "confirmed" }, 3600000),
  );
  await page.goto("/cart");
  await tabTo(page, /Finalizar|checkout|Ir para o pagamento/i);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.locator("#connection-status")).toContainText("conectada");
  await expect(page.locator(".checkout-amounts")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await tabTo(page, /^Confirmar compra$/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/orders\/order-\d+$/);
  await page.evaluate(() => window.__KURIO_TEST__.resolvePayments());
  await expect(heading(page)).toHaveText(
    "Seus NFTs agora estão na sua carteira",
  );
  await page.goto("/account/profile");
  await expect(page.getByLabel("Nome de exibição")).toBeVisible();
  await tabTo(page, /^Nome de exibição/);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Ada Teclado");
  await tabTo(page, /^Salvar$/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".account-summary")).toContainText(
    "Dados do perfil: salvos.",
  );
  await page.goto("/account/wallets");
  const nickname = page
    .getByRole("region", { name: "Carteira principal" })
    .getByLabel("Apelido da carteira");
  await expect(nickname).toBeVisible();
  await tabTo(page, /^Apelido da carteira/);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Principal teclado");
  await tabTo(page, /^Salvar/);
  await page.keyboard.press("Enter");
  await expect(nickname).toHaveValue("Principal teclado");
  await expect(page.locator("#main")).toContainText("salva");
});
