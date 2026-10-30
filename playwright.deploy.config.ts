import { defineConfig, devices } from "@playwright/test";
// Smoke tests against a published URL (or a local `vite preview`): no local
// server is started and only public behavior is used (the published build
// has no test bridge). DEPLOY_URL=https://… npm run test:deploy
const url = process.env.DEPLOY_URL;
if (!url) throw new Error("Set DEPLOY_URL to the site to verify.");
export default defineConfig({
  testDir: "./tests/deploy",
  outputDir: "test-results/deploy",
  fullyParallel: true,
  // Same bound as the other suites; every test gets a fresh browser context.
  workers: Number(process.env.PW_WORKERS) || 2,
  retries: 0,
  // A remote site and its service worker can be slower than the local build.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/deploy" }],
  ],
  use: {
    baseURL: url,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "deploy-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "deploy-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
});
