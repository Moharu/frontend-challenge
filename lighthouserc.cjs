module.exports = {
  ci: {
    collect: {
      url: ["http://127.0.0.1:4174/"],
      numberOfRuns: 3,
      startServerCommand:
        "npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
      startServerReadyPattern: "Local",
      settings: { chromeFlags: "--headless --no-sandbox" },
    },
    upload: { target: "filesystem", outputDir: "reports/lighthouse/mobile" },
  },
};
