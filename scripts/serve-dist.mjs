// Serves dist/ like the published site, for a reproducible local Lighthouse
// reference: Brotli/gzip compression of text files, the SPA rewrite (except
// /api/*, which is a 404 outside the service worker) and the cache headers of
// vercel.json. `vite preview` compresses nothing, which inflates the
// simulated mobile metrics. Usage: node scripts/serve-dist.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";
const root = join(process.cwd(), "dist");
const port = Number(process.argv[2] ?? 4174);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};
const compressible = /^(text\/|application\/(javascript|json)|image\/svg)/;
const cache = new Map();
function cacheControl(path) {
  if (/^\/assets\/(art|figma|fonts)\//.test(path))
    return "public, max-age=604800";
  if (/^\/assets\/[^/]+$/.test(path))
    return "public, max-age=31536000, immutable";
  return "no-cache";
}
async function file(path) {
  const full = normalize(join(root, path));
  if (!full.startsWith(root)) return null;
  try {
    if (!(await stat(full)).isFile()) return null;
    return await readFile(full);
  } catch {
    return null;
  }
}
createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://x").pathname);
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  let body = path === "/" ? null : await file(path);
  let served = path;
  if (!body) {
    if (/^\/api(\/|$)/.test(path)) {
      response.writeHead(404, { ...headers, "Content-Type": "text/plain" });
      return response.end("The page could not be found");
    }
    body = await file("/index.html");
    served = "/index.html";
  }
  const type = types[extname(served)] ?? "application/octet-stream";
  Object.assign(headers, {
    "Content-Type": type,
    "Cache-Control": cacheControl(served === "/index.html" ? path : served),
    Vary: "Accept-Encoding",
  });
  const accepts = String(request.headers["accept-encoding"] ?? "");
  const encoding = !compressible.test(type)
    ? null
    : /\bbr\b/.test(accepts)
      ? "br"
      : /\bgzip\b/.test(accepts)
        ? "gzip"
        : null;
  if (encoding) {
    const key = `${encoding}:${served}`;
    if (!cache.has(key))
      cache.set(
        key,
        encoding === "br"
          ? brotliCompressSync(body, {
              params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
            })
          : gzipSync(body, { level: 9 }),
      );
    body = cache.get(key);
    headers["Content-Encoding"] = encoding;
  }
  headers["Content-Length"] = body.length;
  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : body);
}).listen(port, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${port}/`),
);
