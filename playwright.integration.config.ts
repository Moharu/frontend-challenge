import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/integration",
  outputDir: "test-results/integration",
  fullyParallel: true,
  // Two browsers at a time by default: unbounded parallel Chromium crashed
  // the browser ("Target crashed") and the editor under WSL. Override with
  // PW_WORKERS=n or --workers=n when the machine has room.
  workers: Number(process.env.PW_WORKERS) || 2,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report/integration" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4178",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "eth-unit", testMatch: "eth.spec.ts" },
    { name: "contracts-unit", testMatch: "wallets.spec.ts" },
    {
      name: "protocol-chromium",
      testMatch: "foundation.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "discovery-desktop",
      testMatch: "discovery.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "discovery-mobile",
      testMatch: "discovery.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "cart-desktop",
      testMatch: "cart.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "cart-mobile",
      testMatch: "cart.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "session-desktop",
      testMatch: "session.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "session-mobile",
      testMatch: "session.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "checkout-desktop",
      testMatch: "checkout.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "checkout-mobile",
      testMatch: "checkout.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "orders-desktop",
      testMatch: "orders.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "orders-mobile",
      testMatch: "orders.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command:
      "npm run preview -- --outDir dist-integration --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
});
