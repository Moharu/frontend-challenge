import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: true,
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
    { name: "protocol-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command:
      "npm run preview -- --outDir dist-integration --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
});
