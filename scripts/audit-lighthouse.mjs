import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
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
  // Under WSL, chrome-launcher builds a Windows TEMP path that Linux Chromium
  // resolves relative to the working directory and never removes.
  for (const entry of readdirSync(".")) {
    if (/^C:\\.*\\lighthouse\./.test(entry))
      rmSync(entry, { recursive: true, force: true });
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
