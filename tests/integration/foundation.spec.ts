import { test, expect } from "@playwright/test";
import type { Harness } from "../../src/testing/harness";
declare global {
  interface Window {
    __KURIO_TEST__: Harness;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
  await page.evaluate(() => window.__KURIO_TEST__.reset());
});

test("REST filtering, stable sorting, pagination and named empty scenario", async ({
  page,
}) => {
  const first = await page.evaluate(() => window.__KURIO_TEST__.list());
  expect(first.pagination).toEqual({
    page: 1,
    pageSize: 8,
    total: 24,
    pages: 3,
  });
  const third = await page.evaluate(() =>
    window.__KURIO_TEST__.list({ page: 3 }),
  );
  expect(third.data).toHaveLength(8);
  expect(new Set([...first.data, ...third.data].map((n) => n.id)).size).toBe(
    16,
  );
  const filtered = await page.evaluate(() =>
    window.__KURIO_TEST__.list({
      search: " AURORA ",
      category: "art",
      network: "ethereum",
      minPrice: "2",
      maxPrice: "6",
      sort: "price-asc",
    }),
  );
  expect(filtered.data.map((n) => n.id)).toEqual(["nft-019", "nft-013"]);
  for (const nft of filtered.data) {
    expect(nft.category).toBe("art");
    expect(nft.network).toBe("ethereum");
  }
  const ordering = await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    const r = await h.list({ sort: "price-asc", pageSize: 50 });
    return r.data.every(
      (n, i) =>
        !i ||
        h.compareEth(
          r.data[i - 1].editions[0].priceEth,
          n.editions[0].priceEth,
        ) <= 0,
    );
  });
  expect(ordering).toBe(true);
  await page.evaluate(() => window.__KURIO_TEST__.scenario("empty"));
  const empty = await page.evaluate(() => window.__KURIO_TEST__.list());
  expect(empty.data).toEqual([]);
  expect(empty.pagination.total).toBe(0);
});

test("detail, invalid query errors and unsupported API paths use JSON errors", async ({
  page,
}) => {
  const detail = await page.evaluate(() =>
    window.__KURIO_TEST__.detail("nft-001"),
  );
  expect(detail.data.editions[0].id).toBe("edition-1-limited");
  for (const query of [
    "page=0",
    "page=1.5",
    "pageSize=51",
    "sort=invalid",
    "network=invalid",
    "minPrice=NaN",
    "minPrice=2&maxPrice=1",
    "page=1&page=2",
    "unknown=true",
  ]) {
    const r = await page.evaluate(
      (q) => window.__KURIO_TEST__.request(`/nfts?${q}`),
      query,
    );
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({
      error: { code: "VALIDATION", retryable: false },
    });
  }
  const missing = await page.evaluate(() =>
    window.__KURIO_TEST__.request("/nfts/missing"),
  );
  expect(missing.status).toBe(404);
  expect(missing.body).toMatchObject({ error: { code: "NOT_FOUND" } });
  const unsupported = await page.evaluate(() =>
    window.__KURIO_TEST__.request("/orders"),
  );
  expect(unsupported.status).toBe(501);
  expect(unsupported.body).toMatchObject({
    error: { code: "NOT_IMPLEMENTED" },
  });
});

test("ETH filtering distinguishes values beyond floating-point precision", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    return {
      comparison: h.compareEth(
        "9007199254740993.000000000000000001",
        "9007199254740993.000000000000000002",
      ),
      response: await h.list({
        minPrice: "1.000000000000000001",
        maxPrice: "1.000000000000000001",
        sort: "price-asc",
      }),
    };
  });
  expect(result.comparison).toBe(-1);
  expect(result.response.data.map((n) => n.id)).toEqual(["nft-001"]);
});

test("serialized writes persist across reload; full reset and corruption recovery preserve unrelated storage", async ({
  page,
}) => {
  await page.evaluate(async () => {
    localStorage.setItem("unrelated", "keep");
    await Promise.all([
      window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
        priceEth: "5",
      }),
      window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
        available: 2,
      }),
    ]);
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__KURIO_TEST__);
  const detail = await page.evaluate(() =>
    window.__KURIO_TEST__.detail("nft-001"),
  );
  expect(detail.data.version).toBe(3);
  expect(detail.data.editions[0]).toMatchObject({
    priceEth: "5",
    available: 2,
  });
  await page.evaluate(() => window.__KURIO_TEST__.reset());
  const reset = await page.evaluate(() =>
    window.__KURIO_TEST__.detail("nft-001"),
  );
  expect(reset.data.version).toBe(1);
  expect(reset.data.editions[0]).toMatchObject({
    priceEth: "1.000000000000000001",
    available: 10,
  });
  expect(await page.evaluate(() => localStorage.getItem("unrelated"))).toBe(
    "keep",
  );
  for (const corrupt of [
    "{broken",
    '{"schemaVersion":99}',
    '{"schemaVersion":1,"seedVersion":99}',
  ]) {
    await page.evaluate(
      (value) => localStorage.setItem("kurio.mock.catalog.v1", value),
      corrupt,
    );
    await page.reload();
    await page.waitForFunction(() => !!window.__KURIO_TEST__);
    expect(
      await page.evaluate(() => window.__KURIO_TEST__.snapshot().nfts.length),
    ).toBe(24);
    expect(
      await page.evaluate(() => window.__KURIO_TEST__.snapshot().tick),
    ).toBe(0);
  }
});

test("out-of-order queries stay isolated and selection change forwards cancellation to Axios", async ({
  page,
}) => {
  await page.evaluate(() => {
    const h = window.__KURIO_TEST__;
    h.scenario("out-of-order");
    h.select({ search: "aurora" });
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().requests.started),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => window.__KURIO_TEST__.select({ search: "rhythm" }));
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().selected?.fetching),
    )
    .toBe(false);
  const state = await page.evaluate(() => window.__KURIO_TEST__.state());
  expect(state.selected?.search).toBe("rhythm");
  expect(state.selected?.ids).toHaveLength(8);
  expect(state.transport.aborted).toBeGreaterThan(0);
  const results = await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    const completion: string[] = [];
    await Promise.all([
      h.list({ search: "aurora" }).then(() => completion.push("aurora")),
      h.list({ search: "lens" }).then(() => completion.push("lens")),
    ]);
    return { completion, state: h.state() };
  });
  expect(results.completion).toEqual(["lens", "aurora"]);
  expect(results.state.selected?.search).toBe("rhythm");
});

test("one-shot and named HTTP/network failures recover without fabricated success", async ({
  page,
}) => {
  for (const kind of ["http", "network"] as const) {
    await page.evaluate((k) => window.__KURIO_TEST__.failNext(k), kind);
    const failed = await page.evaluate(() =>
      window.__KURIO_TEST__.request("/nfts"),
    );
    if (kind === "http") {
      expect(failed.status).toBe(503);
      expect(failed.body).toMatchObject({
        error: { code: "TRANSIENT", retryable: true },
      });
    } else expect(failed.network).toBe(true);
    expect(
      (await page.evaluate(() => window.__KURIO_TEST__.list())).pagination
        .total,
    ).toBe(24);
  }
  await page.evaluate(() => window.__KURIO_TEST__.scenario("http-error"));
  expect(
    (await page.evaluate(() => window.__KURIO_TEST__.request("/nfts"))).status,
  ).toBe(503);
  await page.evaluate(() => window.__KURIO_TEST__.scenario("default"));
  expect(
    (await page.evaluate(() => window.__KURIO_TEST__.detail("nft-001"))).data
      .version,
  ).toBe(1);
});

test("real Socket.IO receives persisted update, reconciles REST and invalidates list membership", async ({
  page,
}) => {
  await page.evaluate(() => {
    const h = window.__KURIO_TEST__;
    h.watchDetail("nft-001");
    h.select({ maxPrice: "2" });
    h.connect();
  });
  await expect
    .poll(() => page.evaluate(() => window.__KURIO_TEST__.state().connected))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.reconciliations),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__KURIO_TEST__.state().selected?.ids.includes("nft-001"),
      ),
    )
    .toBe(true);
  const event = await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "9",
      available: 0,
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.applied),
    )
    .toBe(1);
  const state = await page.evaluate(() => window.__KURIO_TEST__.state());
  expect(state.detail).toEqual(event.payload);
  expect(state.selected?.ids).not.toContain("nft-001");
  expect(
    (await page.evaluate(() => window.__KURIO_TEST__.rawDetail("nft-001")))
      .data,
  ).toEqual(event.payload);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kurio.mock.catalog.v1")!).nfts[0],
    ),
  ).toEqual(event.payload);
});

test("duplicate and old events never regress or reapply effects", async ({
  page,
}) => {
  await page.evaluate(() => window.__KURIO_TEST__.connect());
  await expect
    .poll(() => page.evaluate(() => window.__KURIO_TEST__.state().connected))
    .toBe(true);
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "5",
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.applied),
    )
    .toBe(1);
  await page.evaluate(() => {
    window.__KURIO_TEST__.duplicate();
    window.__KURIO_TEST__.older();
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.ignored),
    )
    .toBe(2);
  const state = await page.evaluate(() => window.__KURIO_TEST__.state());
  expect(state.stats.applied).toBe(1);
  expect(state.detail?.version).toBe(2);
});

test("transport interruption followed by reconnection refetches active resources through REST", async ({
  page,
}) => {
  await page.evaluate(() => {
    const h = window.__KURIO_TEST__;
    h.watchDetail("nft-001");
    h.select({ maxPrice: "2" });
    h.connect();
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.reconciliations),
    )
    .toBe(1);
  await page.evaluate(() => window.__KURIO_TEST__.interrupt());
  await expect
    .poll(() => page.evaluate(() => window.__KURIO_TEST__.state().connected))
    .toBe(false);
  await page.evaluate(() =>
    window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
      priceEth: "8",
      available: 1,
    }),
  );
  await page.evaluate(() => window.__KURIO_TEST__.restore());
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().detail?.version),
    )
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() => window.__KURIO_TEST__.state().stats.reconciliations),
    )
    .toBeGreaterThan(1);
  const state = await page.evaluate(() => window.__KURIO_TEST__.state());
  expect(state.stats.applied).toBe(0);
  expect(state.selected?.ids).not.toContain("nft-001");
  expect(state.detail?.editions[0].available).toBe(1);
});

test("repeated connection lifecycles release listeners and connections", async ({
  page,
}) => {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      window.__KURIO_TEST__.recreate();
      window.__KURIO_TEST__.connect();
    });
    await expect
      .poll(() => page.evaluate(() => window.__KURIO_TEST__.state().connected))
      .toBe(true);
    expect(
      await page.evaluate(() => window.__KURIO_TEST__.state().listeners),
    ).toBe(1);
    await page.evaluate(() =>
      window.__KURIO_TEST__.update("nft-001", "edition-1-limited", {
        available: 3,
      }),
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.__KURIO_TEST__.state().stats.applied),
      )
      .toBe(1);
    await page.evaluate(() => window.__KURIO_TEST__.dispose());
    await expect
      .poll(() =>
        page.evaluate(() => window.__KURIO_TEST__.state().serverConnections),
      )
      .toBe(0);
    expect(
      await page.evaluate(() => window.__KURIO_TEST__.state().listeners),
    ).toBe(0);
  }
});

test("mock Engine.IO heartbeat keeps an idle client connected past the handshake timeout", async ({
  page,
}) => {
  await page.clock.install();
  await page.evaluate(() => window.__KURIO_TEST__.connect());
  await expect
    .poll(() => page.evaluate(() => window.__KURIO_TEST__.state().connected))
    .toBe(true);
  await page.clock.fastForward(25000);
  await page.clock.fastForward(6000);
  const state = await page.evaluate(() => window.__KURIO_TEST__.state());
  expect(state.connected).toBe(true);
  expect(state.stats.connections).toBe(1);
});

test("reset clears scenario failures, latency and event history along with persisted data", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const h = window.__KURIO_TEST__;
    await h.update("nft-001", "edition-1-limited", { available: 0 });
    h.scenario("network-error");
    h.failNext("http");
    h.delay("", 10000);
    await h.reset();
  });
  const detail = await page.evaluate(() =>
    window.__KURIO_TEST__.detail("nft-001"),
  );
  expect(detail.data.version).toBe(1);
  expect(detail.data.editions[0].available).toBe(10);
  expect(await page.evaluate(() => window.__KURIO_TEST__.snapshot().tick)).toBe(
    0,
  );
  const replay = await page.evaluate(() => {
    try {
      window.__KURIO_TEST__.duplicate();
      return "unexpected";
    } catch {
      return "no history";
    }
  });
  expect(replay).toBe("no history");
});
