/** Run with `node scripts/tests/tailwind-colors.mjs`. Reads source files only. */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Tailwind v4 only generates these shades; anything else (e.g. slate-450) emits no CSS at all.
const shades = new Set(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
const palette = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const colorClass = new RegExp(`\\b(?:${palette})-(\\d{2,3})\\b`, "g");

async function* sourceFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path;
  }
}

const invalid = [];
for await (const file of sourceFiles(resolve(root, "src"))) {
  const lines = (await readFile(file, "utf8")).split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(colorClass)) {
      if (!shades.has(match[1])) invalid.push(`${relative(root, file)}:${index + 1} ${match[0]}`);
    }
  });
}

assert.deepEqual(invalid, [], `Tailwind color shades that do not exist:\n${invalid.join("\n")}`);
console.log("PASS every Tailwind color class uses an existing shade");
