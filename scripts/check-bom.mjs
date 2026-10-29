// Fails when a tracked file starts with a UTF-8 byte order mark. The
// repository is UTF-8 without BOM; some Windows tools add one silently.
import { execFileSync } from "node:child_process";
import { openSync, readSync, closeSync } from "node:fs";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const withBom = files.filter((file) => {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(3);
    const read = readSync(fd, head, 0, 3, 0);
    return (
      read === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf
    );
  } finally {
    closeSync(fd);
  }
});
if (withBom.length) {
  console.error("Arquivos versionados iniciados por BOM UTF-8:");
  for (const file of withBom) console.error(`  ${file}`);
  process.exit(1);
}
