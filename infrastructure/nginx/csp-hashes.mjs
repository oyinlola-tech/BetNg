// Usage: node csp-hashes.mjs <dist/index.html> <out-dir>
// Writes the CSP hash sources for the inline <script>, <style> and style="" content of a built index.html.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [htmlPath, outDir] = process.argv.slice(2);

if (htmlPath === undefined || outDir === undefined) {
  console.error("usage: csp-hashes.mjs <index.html> <out-dir>");
  process.exit(2);
}

const html = readFileSync(htmlPath, "utf8");
const hash = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
const decode = (text) =>
  text
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
const unique = (values) => [...new Set(values)].join(" ");

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes))
  .map(([, , body]) => hash(body));
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(([, body]) => hash(body));
const styleAttributes = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(([, double, single]) =>
  hash(decode(double ?? single ?? "")),
);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "script-hashes"), unique(scripts));
writeFileSync(join(outDir, "style-hashes"), unique(styles));
writeFileSync(join(outDir, "style-attr-hashes"), unique(styleAttributes));
console.log(`csp hashes: ${scripts.length} script, ${styles.length} style, ${styleAttributes.length} style attribute`);
