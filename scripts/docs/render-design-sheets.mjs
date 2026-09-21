// Renders design proof sheets straight from the token and brand packages, so the images cannot drift from the code.
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { darkTheme, lightTheme, typeRole } from "../../packages/design-tokens/dist/index.js";
import { CREST_EMBLEMS, CREST_PATTERNS, CREST_SHAPES, FOOTBALL_EVENT_ICON, FOOTBALL_ICONS, crestFor, crestSvg, footballIconSvg } from "../../packages/brand/dist/index.js";

const OUT = "docs/images/design";
const FONTS = "packages/ui-web/node_modules/@fontsource-variable";
const font = (family, file) => `@font-face{font-family:'${family}';src:url('${pathToFileURL(resolve(FONTS, file)).href}') format('woff2');font-weight:100 900}`;
const BASE = `${font("Inter", "inter/files/inter-latin-wght-normal.woff2")}${font("Archivo", "archivo/files/archivo-latin-wght-normal.woff2")}
*{box-sizing:border-box}body{margin:0;font-family:Inter,sans-serif}
.sheet{padding:32px;display:inline-block;width:1280px}
.h{display:flex;align-items:center;gap:10px;margin:0 0 18px;font:700 12px Inter;letter-spacing:.1em;text-transform:uppercase}
.h:before{content:"";width:3px;height:14px}`;

mkdirSync(OUT, { recursive: true });

function luminance(hex) {
  const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

function colours(name, t) {
  const groups = [
    ["Surfaces", ["background", "surface", "surfaceElevated", "surfaceSunken", "surfaceHover"]],
    ["Text", ["textPrimary", "textSecondary", "textMuted"]],
    ["Lines and focus", ["border", "borderStrong", "focusRing"]],
    ["Brand", ["brand", "brandHover", "brandActive", "brandSubtle"]],
    ["Status", ["success", "warning", "danger", "info", "live", "pending", "void", "suspended"]],
    ["Chart series", ["series1", "series2", "series3"]],
  ];
  const chip = (key) => {
    const hex = t[key];
    const isHex = /^#[0-9A-F]{6}$/i.test(hex);
    const ratio = isHex ? contrast(hex, t.surface) : undefined;

    return `<div style="width:176px;border:1px solid ${t.border};border-radius:10px;overflow:hidden;background:${t.surface}"><div style="height:64px;background:${hex}"></div><div style="padding:10px 12px"><div style="font:600 13px Inter;color:${t.textPrimary}">${key}</div><div style="font:12px 'DejaVu Sans Mono',monospace;color:${t.textMuted};margin-top:2px">${hex}${ratio === undefined ? "" : ` · ${ratio.toFixed(1)}:1`}</div></div></div>`;
  };

  return `<div class="sheet" style="background:${t.background}"><style>.h{color:${t.textMuted}}.h:before{background:${t.brand}}</style>${groups.map(([title, keys]) => `<div class="h">${title}</div><div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:26px">${keys.map(chip).join("")}</div>`).join("")}<div style="font:12px Inter;color:${t.textMuted}">${name} theme · ratios are against the surface colour · generated from packages/design-tokens</div></div>`;
}

function types(t) {
  const sample = { display: "BETNG command center", h1: "Football today", h2: "Match center", h3: "Live matches", sectionHeading: "Starting soon", body: "Every result, price and balance comes from the platform.", small: "Kick-off 18:30 · Matchday 07", caption: "Premier League · Matchday 07", data: "63' · 10 shots · 53%", score: "2 – 1", odds: "2.15   3.20   2.80", financial: "₦12,500.00" };
  const rows = Object.entries(typeRole).map(([name, r]) => {
    const family = r.family === "display" ? "Archivo" : "Inter";

    return `<div style="display:grid;grid-template-columns:220px 1fr;align-items:baseline;gap:24px;padding:14px 0;border-bottom:1px solid ${t.border}"><div style="font:12px 'DejaVu Sans Mono',monospace;color:${t.textMuted}">${name}<br>${family} ${r.weight} · ${r.size}px${r.tabular ? " · tabular" : ""}</div><div style="font-family:${family};font-size:${r.size}px;font-weight:${r.weight};line-height:${r.lineHeight};letter-spacing:${r.tracking};${r.uppercase ? "text-transform:uppercase;" : ""}${r.tabular ? "font-variant-numeric:tabular-nums;" : ""}color:${t.textPrimary}">${sample[name] ?? name}</div></div>`;
  });

  return `<div class="sheet" style="background:${t.background}"><style>.h{color:${t.textMuted}}.h:before{background:${t.brand}}</style><div class="h">Type roles · packages/design-tokens typeRole</div>${rows.join("")}</div>`;
}

function crests(t) {
  const matrix = CREST_SHAPES.map((shape, row) => CREST_PATTERNS.map((pattern, col) => {
    const emblem = CREST_EMBLEMS[(row * 3 + col) % CREST_EMBLEMS.length];
    const palette = [["#1F4E9C", "#F2C230"], ["#A3122A", "#FFFFFF"], ["#0E6B3A", "#F4F1E8"], ["#232323", "#E8B517"], ["#5B2A86", "#F2F2F2"], ["#0B7FAB", "#FFFFFF"], ["#C0561B", "#1B1B1B"], ["#7A1F2B", "#8DB9E8"]][(row + col) % 8];
    const spec = crestFor({ id: `sheet-${shape}-${pattern}`, colors: { primary: palette[0], secondary: palette[1] }, crest: { shape, pattern, emblem } });

    return `<div title="${shape}/${pattern}/${emblem}">${crestSvg(spec, 72, { clipId: `m-${row}-${col}` })}</div>`;
  }).join("")).map((cells, i) => `<div style="display:flex;align-items:center;gap:26px"><div style="width:100px;font:12px 'DejaVu Sans Mono',monospace;color:${t.textMuted}">${CREST_SHAPES[i]}</div>${cells}</div>`).join("");
  const spec = crestFor({ id: "sheet-sizes", colors: { primary: "#1F4E9C", secondary: "#F2C230" } });
  const sizes = [16, 20, 24, 32, 40, 48, 64, 80, 96, 128].map((s) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${crestSvg(spec, s, { clipId: `s-${s}` })}<span style="font:11px 'DejaVu Sans Mono',monospace;color:${t.textMuted}">${s}</span></div>`).join("");

  return `<div class="sheet" style="background:${t.background}"><style>.h{color:${t.textMuted}}.h:before{background:${t.brand}}svg{display:block}</style><div class="h">8 shapes × 10 patterns · emblems vary · crestFor + crestSvg</div><div style="display:flex;gap:26px;margin:0 0 10px 126px;font:11px 'DejaVu Sans Mono',monospace;color:${t.textMuted}">${CREST_PATTERNS.map((p) => `<div style="width:72px;text-align:center">${p}</div>`).join("")}</div><div style="display:flex;flex-direction:column;gap:14px">${matrix}</div><div class="h" style="margin-top:34px">One crest at every supported size · detail steps down below 40 and 24</div><div style="display:flex;align-items:flex-end;gap:28px">${sizes}</div></div>`;
}

function icons(t) {
  const byName = Object.fromEntries(Object.entries(FOOTBALL_EVENT_ICON).map(([kind, name]) => [name, kind]));
  const cards = { yellowCard: t.warning, redCard: t.danger };
  const cells = Object.keys(FOOTBALL_ICONS).map((name) => `<div style="width:140px;border:1px solid ${t.border};border-radius:10px;background:${t.surface};padding:16px 10px;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="display:flex;align-items:flex-end;gap:12px;color:${t.textPrimary}">${footballIconSvg(name, { size: 40, cardFill: cards[name] })}${footballIconSvg(name, { size: 20, cardFill: cards[name] })}${footballIconSvg(name, { size: 16, cardFill: cards[name] })}</div><div style="font:600 12px Inter;color:${t.textPrimary}">${name}</div><div style="font:10px 'DejaVu Sans Mono',monospace;color:${t.textMuted}">${byName[name] ?? "interface"}</div></div>`).join("");

  return `<div class="sheet" style="background:${t.background}"><style>.h{color:${t.textMuted}}.h:before{background:${t.brand}}svg{display:block}</style><div class="h">23 football icons · 40 / 20 / 16 px · FOOTBALL_ICONS, mapped to event kinds</div><div style="display:flex;flex-wrap:wrap;gap:12px">${cells}</div></div>`;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--allow-file-access-from-files"], ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}) });
const page = await browser.newPage({ deviceScaleFactor: 1.5, viewport: { width: 1344, height: 900 } });
const sheets = [
  ["colours-light", colours("Light", lightTheme)],
  ["colours-dark", colours("Dark", darkTheme)],
  ["type-roles", types(lightTheme)],
  ["crests-light", crests(lightTheme)],
  ["crests-dark", crests(darkTheme)],
  ["icons-light", icons(lightTheme)],
  ["icons-dark", icons(darkTheme)],
];

for (const [name, body] of sheets) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>${body}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".sheet").screenshot({ path: `${OUT}/${name}.png` });
}

await browser.close();
console.log(`${String(sheets.length)} sheets`);
