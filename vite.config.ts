import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Startup awaits MSW before rendering, but the mocks chunk is only discovered
// after the main bundle runs. Preloading it (and its imports) in index.html
// downloads it in parallel. Builds with mocks disabled are left untouched.
function preloadMocks(enabled: boolean): Plugin {
  return {
    name: "kurio-preload-mocks",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle }) {
        if (!enabled || !bundle) return;
        const entry = Object.values(bundle).find(
          (chunk) =>
            chunk.type === "chunk" &&
            chunk.facadeModuleId?.endsWith("/src/mocks/browser.ts"),
        );
        if (!entry || entry.type !== "chunk") return;
        return [entry.fileName, ...entry.imports]
          .filter((file) => !html.includes(`/${file}"`))
          .map((file) => ({
            tag: "link",
            attrs: {
              rel: "modulepreload",
              crossorigin: true,
              href: `/${file}`,
            },
            injectTo: "head",
          }));
      },
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      tailwindcss(),
      preloadMocks((env.VITE_ENABLE_MOCKS ?? "true") === "true"),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
  };
});
