import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CREST_EMBLEMS, CREST_PATTERNS, CREST_SHAPES, crestLayers, crestSvg, shapePath } from "./crest/index.js";
import type { CrestSpec } from "./crest/index.js";
import { layerMarkup } from "./crest/svg.js";
import { LEAGUE_MARKS, leagueMarkSvg } from "./leagues.js";
import { logoSvg } from "./logo.js";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../svg");

const SHEET_KITS: readonly (readonly [string, string, string])[] = [
  ["#B3202A", "#F4F1EA", "#FFFFFF"],
  ["#123C7A", "#F2C230", "#FFFFFF"],
  ["#0F5C45", "#F4F1EA", "#FFFFFF"],
  ["#15161A", "#D9A520", "#FFFFFF"],
  ["#F2C230", "#15161A", "#14130F"],
  ["#5B2A86", "#9AD1E8", "#FFFFFF"],
  ["#F4F1EA", "#B3202A", "#14130F"],
  ["#E2601C", "#1B2440", "#FFFFFF"],
];

function crestSheet(): string {
  const cell = 96;
  const pad = 16;
  const cols = CREST_PATTERNS.length;
  const rows = CREST_SHAPES.length;
  const width = cols * cell + pad * 2;
  const height = rows * cell + pad * 2;
  const defs = CREST_SHAPES.map((shape) => `<clipPath id="bn-crest-${shape}"><path d="${shapePath(shape)}"/></clipPath>`).join("");
  let body = "";

  CREST_SHAPES.forEach((shape, row) => {
    CREST_PATTERNS.forEach((pattern, col) => {
      const kit = SHEET_KITS[(row + col) % SHEET_KITS.length] ?? ["#1F2A44", "#E6E1D6", "#FFFFFF"];
      const emblem = CREST_EMBLEMS[(row * 3 + col) % CREST_EMBLEMS.length] ?? "star";
      const spec: CrestSpec = { shape, pattern, emblem, primary: kit[0], secondary: kit[1], accent: kit[2] };
      const x = pad + col * cell + (cell - 64) / 2;
      const y = pad + row * cell + (cell - 64) / 2;

      body += `<g transform="translate(${String(x)} ${String(y)})">${crestLayers(spec, "full")
        .map((layer) => layerMarkup(layer, `bn-crest-${shape}`))
        .join("")}</g>`;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><defs>${defs}</defs><rect width="100%" height="100%" fill="#F5F3EE"/>${body}</svg>`;
}

mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "betng-logo.svg"), logoSvg({ tile: "#2457F5", ink: "#FFFFFF", size: 256 }));
writeFileSync(resolve(out, "betng-logo-dark.svg"), logoSvg({ tile: "#4C7DFF", ink: "#0A0C10", size: 256 }));
writeFileSync(resolve(out, "betng-logo-mono.svg"), logoSvg({ tile: "#0E1218", ink: "#FFFFFF", size: 256 }));

for (const mark of LEAGUE_MARKS) writeFileSync(resolve(out, `league-${mark.slug}.svg`), leagueMarkSvg(mark, 192));

writeFileSync(resolve(out, "crest-sheet.svg"), crestSheet());

CREST_SHAPES.forEach((shape, i) => {
  const kit = SHEET_KITS[i % SHEET_KITS.length] ?? ["#1F2A44", "#E6E1D6", "#FFFFFF"];
  const spec: CrestSpec = {
    shape,
    pattern: CREST_PATTERNS[(i * 3 + 1) % CREST_PATTERNS.length] ?? "solid",
    emblem: CREST_EMBLEMS[(i * 5) % CREST_EMBLEMS.length] ?? "star",
    primary: kit[0],
    secondary: kit[1],
    accent: kit[2],
  };

  writeFileSync(resolve(out, `crest-sample-${shape}.svg`), crestSvg(spec, 256));
});
