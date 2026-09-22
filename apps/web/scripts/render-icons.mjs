// Renders the install and notification icons in public/icons from the brand logo: node apps/web/scripts/render-icons.mjs
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { LOGO_B_PATH, LOGO_CUT_PATH, LOGO_VIEWBOX, logoSvg } from "../../../packages/brand/dist/index.js";
import { lightTheme } from "../../../packages/design-tokens/dist/index.js";

const OUT = new URL("../public/icons/", import.meta.url);
const TILE = lightTheme.brand;
const INK = "#FFFFFF";

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}">${body}</svg>`;
const mark = (fill, cut) => `<path d="${LOGO_B_PATH}" fill="${fill}"/><path d="${LOGO_CUT_PATH}" fill="${cut}" opacity="0.92"/>`;

const icons = {
  any: logoSvg({ tile: TILE, ink: INK, size: 512 }),
  // The mark sits inside the central 60% so every platform mask keeps it whole.
  maskable: svg(`<rect width="64" height="64" fill="${TILE}"/><g transform="translate(12.8 12.8) scale(0.6)">${mark(INK, TILE)}</g>`),
  // Notification badges are read as an alpha mask: white on transparent, no tile.
  badge: svg(`<g transform="translate(6.4 6.4) scale(0.8)"><path d="${LOGO_B_PATH}" fill="${INK}"/></g>`),
};

const targets = [
  ["icon-192.png", "any", 192],
  ["icon-512.png", "any", 512],
  ["maskable-192.png", "maskable", 192],
  ["maskable-512.png", "maskable", 512],
  ["apple-touch-icon.png", "maskable", 180],
  ["badge-96.png", "badge", 96],
];

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("icon.svg", OUT), icons.any.replace(/ width="\d+" height="\d+"/, ""));
writeFileSync(new URL("maskable.svg", OUT), icons.maskable);

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}) });

try {
  for (const [name, kind, size] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const markup = icons[kind].replace(/<svg /, `<svg width="${String(size)}" height="${String(size)}" `).replace(/ width="512" height="512"/, "");

    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`);
    writeFileSync(new URL(name, OUT), await page.locator("svg").screenshot({ omitBackground: true }));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`icons: ${String(targets.length)} png, 2 svg`);
