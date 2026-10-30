import { test, expect } from "@playwright/test";
import type { Harness } from "../../src/testing/harness";
declare global {
  interface Window {
    __KURIO_TEST__: Harness;
  }
}
// Contextos novos por teste mantêm o estado inicial isolado. O protocolo usa /__protocol.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
  await expect(
    page.getByRole("link", { name: "Ver Emerald Ape #042", exact: true }),
  ).toBeVisible();
});
test("busca, filtros, modos, paginação e histórico são baseados na URL", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Página 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Em alta", exact: true }).click();
  await expect(page).toHaveURL(/mode=trending/);
  await expect(page).toHaveURL(/page=1/);
  await page
    .getByRole("button", { name: "Novos lançamentos", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "NFTs encontrados" }),
  ).toContainText("8 NFTs");
  await page
    .getByRole("button", { name: "Todos os NFTs", exact: true })
    .click();
  // Desktop opens the search field inside the header; mobile shows it inline.
  if (
    await page
      .getByRole("button", { name: "Buscar NFTs", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Buscar NFTs", exact: true })
      .click();
  await page
    .getByRole("textbox", { name: "Buscar NFTs", exact: true })
    .fill("Sage");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/search=sage/);
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(4);
  await page.goBack();
  await expect(page).not.toHaveURL(/search=sage/);
  await page.goForward();
  await expect(page).toHaveURL(/search=sage/);
  await page.goto(
    "/?category=art&network=ethereum&minPrice=2&maxPrice=6&sort=price-desc",
  );
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Ordenar NFTs" })
    .selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
});
test("URLs inválidas são normalizadas e resultados vazios permitem recuperação", async ({
  page,
}) => {
  await page.goto("/?page=invalid&network=unknown&sort=oops");
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(9);
  await page.goto("/?search=nenhum-resultado");
  await expect(
    page.getByRole("heading", { name: "Nenhum NFT encontrado" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .last()
    .click();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(9);
});
test("galeria, abas, limites e links relacionados funcionam no detalhe", async ({
  page,
}) => {
  await page
    .getByRole("link", { name: "Ver Emerald Ape #042", exact: true })
    .click();
  await page.getByRole("button", { name: "Imagem 3", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Imagem 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ampliar imagem" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Ampliar imagem" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "1/1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "1/20", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Qtd." }).fill("99");
  await expect(page.getByRole("alert")).toContainText("Quantidade inválida");
  await page.getByRole("button", { name: "Corrigir quantidade" }).click();
  await expect(page.getByRole("spinbutton")).toHaveValue("5");
  await page.getByRole("tab", { name: /Avaliações de colecionadores/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Avaliação fictícia");
  await page
    .locator(".related")
    .getByRole("link", { name: /Ver Sage/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Sage Nomad #043", exact: true }),
  ).toBeVisible();
  await page.goto("/nfts/missing");
  await expect(
    page.getByRole("heading", { name: "NFT não encontrado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao catálogo" }).click();
  await expect(page).toHaveURL(/\/$|pageSize/);
});
test("skeleton, falha e recuperação passam pelos handlers reais", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__KURIO_TEST__.delay("", 1500);
    window.__KURIO_TEST__.failNext("http");
  });
  await page
    .getByRole("link", { name: "Ver Emerald Ape #042", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Carregando NFTs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Não foi possível carregar os NFTs" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
});
test("preço, disponibilidade, duplicatas e reconexão atualizam a interface", async ({
  page,
}) => {
  await page
    .getByRole("link", { name: "Ver Emerald Ape #042", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "9",
      available: 2,
    }),
  );
  await expect(page.locator(".price-reviews .price")).toHaveText("9 ETH");
  await expect(
    page.getByRole("status").filter({ hasText: "Preço ou disponibilidade" }),
  ).toBeVisible();
  await page.getByRole("spinbutton").fill("3");
  await expect(page.getByRole("alert")).toContainText("limite atual é 2");
  await page.evaluate(() => {
    window.__KURIO_TEST__.duplicate();
    window.__KURIO_TEST__.older();
  });
  await expect(page.locator(".price-reviews .price")).toHaveText("9 ETH");
  await page.evaluate(() => window.__KURIO_TEST__.interrupt());
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "8",
      available: 0,
    }),
  );
  await page.evaluate(() => window.__KURIO_TEST__.restore());
  await expect(page.locator(".price-reviews .price")).toHaveText("8 ETH");
  await expect(page.getByRole("alert")).toContainText(
    "edição selecionada está indisponível",
  );
  await expect(
    page.getByRole("button", { name: "Comprar NFT", exact: true }),
  ).toBeDisabled();
});
// The option's name carries the number of matching NFTs: "Solana (6)".
const solana = /^Solana \(\d+\)$/;
test("aplicar filtros a partir da página 2 volta à página 1 (barra lateral e drawer)", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?page=2");
    await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
    const drawer = width < 700;
    if (drawer)
      await page.getByRole("button", { name: "Abrir filtros" }).click();
    const form = drawer
      ? page.getByRole("dialog")
      : page.locator(".catalog-layout aside");
    await form.getByRole("radio", { name: solana }).check();
    // The sidebar applies on choice; the drawer waits for Aplicar.
    if (drawer)
      await form.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page).toHaveURL(/network=solana/);
    await expect(page).toHaveURL(/page=1(&|$)/);
    // The single page of results is shown, never an empty catalog.
    await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Página 1", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});
test("faixa de preço pelo teclado: setas movem o marcador e Aplicar filtra", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "barra lateral (o drawer usa o mesmo componente)",
  );
  const aside = page.locator(".catalog-layout aside");
  const min = aside.getByRole("slider", { name: "Preço mínimo (ETH)" });
  await expect(min).toHaveAttribute("aria-valuetext", /ETH$/);
  const start = Number(await min.getAttribute("aria-valuenow"));
  await min.focus();
  for (let i = 0; i < 50; i++) await page.keyboard.press("ArrowRight");
  await expect(min).toHaveAttribute("aria-valuenow", String(start + 50));
  await aside.getByRole("button", { name: "Aplicar", exact: true }).click();
  // The router writes the string in quotes: minPrice=%221.5%22.
  await expect(page).toHaveURL(/minPrice=(%22)?\d/);
  await expect(page.locator(".nft-grid .nft-card").first()).toBeVisible();
});
test("barra lateral: Limpar filtros aplica na hora", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "sem barra lateral no mobile (o drawer tem teste próprio)",
  );
  await page.goto("/?network=solana&category=art");
  const aside = page.locator(".catalog-layout aside");
  await aside.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/[?&]network=(&|$)/);
  await expect(page).toHaveURL(/[?&]category=(&|$)/);
});
test("drawer mobile aplica, cancela e limpa sem antecipar mudanças na URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = page.url();
  await page.getByRole("button", { name: "Abrir filtros" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: solana }).check();
  await drawer.getByRole("button", { name: "Cancelar" }).click();
  expect(page.url()).toBe(before);
  await page.getByRole("button", { name: "Abrir filtros" }).click();
  await drawer.getByRole("radio", { name: solana }).check();
  await drawer.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page).toHaveURL(/network=solana/);
  await page.getByRole("button", { name: "Abrir filtros" }).click();
  await drawer.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/network=solana/);
  await drawer.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".nft-grid .nft-card")).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
