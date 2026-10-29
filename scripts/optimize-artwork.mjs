// Derives responsive WebP artwork from the versioned Figma PNGs, using the
// Playwright Chromium canvas encoder so no image dependency is needed.
/* global Image, document -- used inside the page.evaluate callback */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { artSources, artWidths } from "../src/components/discovery/assets.ts";
const quality = 0.82;
mkdirSync("public/assets/art", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [art, file] of Object.entries(artSources)) {
  const png = readFileSync(`public/assets/figma/${file}`).toString("base64");
  const outputs = await page.evaluate(
    async ({ png, widths, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      return widths.map((width) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.round((image.height * width) / image.width);
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", quality).split(",")[1];
      });
    },
    { png, widths: artWidths, quality },
  );
  artWidths.forEach((width, i) => {
    const target = `public/assets/art/${art}-${width}.webp`;
    writeFileSync(target, Buffer.from(outputs[i], "base64"));
    console.log(target);
  });
}
await browser.close();
