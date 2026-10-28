import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const cli = require.resolve("@lhci/cli/src/cli.js");
for (const profile of ["mobile", "desktop"]) {
  const args = [
    cli,
    "autorun",
    "--config=lighthouserc.cjs",
    `--upload.outputDir=reports/lighthouse/${profile}`,
  ];
  if (profile === "desktop") args.push("--collect.settings.preset=desktop");
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, CHROME_PATH: chromium.executablePath() },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
