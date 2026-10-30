// LIGHTHOUSE_URL measures a published build (the official measurement);
// without it, the local build is measured (reproducible reference, used to
// validate changes before a push), served by scripts/serve-dist.mjs with the
// compression and headers of the published site.
const base = (process.env.LIGHTHOUSE_URL ?? "").replace(/\/$/, "");
const local = "http://127.0.0.1:4174";
module.exports = {
  ci: {
    collect: {
      url: [`${base || local}/`, `${base || local}/nfts/nft-001`],
      numberOfRuns: 3,
      ...(base
        ? {}
        : {
            startServerCommand: "node scripts/serve-dist.mjs 4174",
            startServerReadyPattern: "Local",
          }),
      settings: { chromeFlags: "--headless --no-sandbox" },
    },
    upload: { target: "filesystem", outputDir: "reports/lighthouse/mobile" },
  },
};
