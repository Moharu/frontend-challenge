// Prints median scores and metrics per profile/route from retained reports.
import { readdirSync, readFileSync } from "node:fs";
const median = (values) =>
  [...values].sort((a, b) => a - b)[values.length >> 1];
for (const profile of ["mobile", "desktop"]) {
  const dir = `reports/lighthouse/${profile}`;
  const groups = {};
  for (const file of readdirSync(dir).filter((f) =>
    f.endsWith(".report.json"),
  )) {
    const report = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    const route = new URL(report.finalDisplayedUrl).pathname;
    (groups[route] ??= []).push(report);
  }
  for (const [route, reports] of Object.entries(groups)) {
    const score = (k) =>
      median(reports.map((r) => Math.round(r.categories[k].score * 100)));
    const metric = (k) => median(reports.map((r) => r.audits[k].numericValue));
    console.log(
      [
        profile,
        route,
        `runs=${reports.length}`,
        `perf=${score("performance")}`,
        `a11y=${score("accessibility")}`,
        `bp=${score("best-practices")}`,
        `seo=${score("seo")}`,
        `LCP=${Math.round(metric("largest-contentful-paint"))}ms`,
        `CLS=${metric("cumulative-layout-shift").toFixed(3)}`,
        `TBT=${Math.round(metric("total-blocking-time"))}ms`,
      ].join(" "),
    );
  }
}
