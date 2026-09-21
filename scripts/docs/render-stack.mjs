// Builds docs/images/stack/stack-{light,dark}.svg from the Simple Icons marks in docs/images/stack.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "docs/images/stack";

const GROUPS = [
  {
    title: "Clients",
    items: [
      ["react", "React", "19", "61DAFB"],
      ["typescript", "TypeScript", "7", "3178C6"],
      ["vite", "Vite", "8", "646CFF"],
      ["tailwindcss", "Tailwind CSS", "4", "06B6D4"],
      ["reactrouter", "React Router", "8", "CA4245"],
      ["expo", "Expo", "54", "000020"],
      ["lucide", "Lucide", "icons", "F56565"],
    ],
  },
  {
    title: "State, data and forms",
    items: [
      ["reactquery", "TanStack Query", "5", "FF4154"],
      [null, "Zustand", "5", "443E38", "Zu"],
      ["reacthookform", "React Hook Form", "7", "EC5990"],
      ["zod", "Zod", "4", "3E67B1"],
    ],
  },
  {
    title: "Platform services",
    items: [
      ["nodedotjs", "Node.js", "24", "5FA04E"],
      ["zudo", "ZudoJS", "services", "1A1A2E"],
      ["python", "Python", "3.14", "3776AB"],
      ["fastapi", "FastAPI", "0.120", "009688"],
      ["pydantic", "Pydantic", "2", "E92063"],
      ["prisma", "Prisma", "7", "2D3748"],
    ],
  },
  {
    title: "Storage and infrastructure",
    items: [
      ["postgresql", "PostgreSQL", "17", "4169E1"],
      ["redis", "Redis", "8", "FF4438"],
      ["docker", "Docker", "compose", "2496ED"],
      ["pnpm", "pnpm", "11", "F69220"],
    ],
  },
  {
    title: "Quality",
    items: [
      ["vitest", "Vitest", "5", "6E9F18"],
      ["testinglibrary", "Testing Library", "16", "E33332"],
      [null, "Playwright", "1.63", "2EAD33", "Pw"],
      [null, "axe-core", "4", "663399", "ax"],
      ["pytest", "Pytest", "8", "0A9EDC"],
      ["eslint", "ESLint", "10", "4B32C3"],
      ["prettier", "Prettier", "3", "F7B93E"],
    ],
  },
];

const THEMES = {
  light: { bg: "#F5F3EE", card: "#FDFCFA", border: "#E3DFD6", text: "#14130F", muted: "#696459", tick: "#2457F5" },
  dark: { bg: "#0A0C10", card: "#12151B", border: "#222732", text: "#F2F4F7", muted: "#8690A0", tick: "#4C7DFF" },
};

const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
const W = 1200;
const PAD = 32;
const TILE_W = 152;
const TILE_H = 116;
const GAP = 12;
const PER_ROW = 7;

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

const pathOf = (slug) => /<path d="([^"]+)"/.exec(readFileSync(`${DIR}/${slug}.svg`, "utf8"))[1];
// The official ZudoJS mark, embedded unaltered: the standard file on light, the reversed file on dark (zudojs.oyinlola.site/brand).
const zudoMark = (dark) =>
  readFileSync(`${DIR}/zudo-mark${dark ? "-dark" : ""}.svg`, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function tile(x, y, [slug, name, version, hex, mono], t) {
  const card = t.card.slice(1);
  const ink = contrast(hex, card) >= 2.2 ? `#${hex}` : t.text;
  const zudo = slug === "zudo" ? zudoMark(t === THEMES.dark) : undefined;
  const mark =
    zudo !== undefined
      ? `<svg x="${x + TILE_W / 2 - 20}" y="${y + 18}" width="40" height="40" viewBox="0 0 80 80">${zudo}</svg>`
      : slug === null
      ? `<rect x="${x + TILE_W / 2 - 20}" y="${y + 18}" width="40" height="40" rx="9" fill="#${hex}"/><text x="${x + TILE_W / 2}" y="${y + 44}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="800" fill="${contrast("FFFFFF", hex) >= 3 ? "#FFFFFF" : "#14130F"}">${mono}</text>`
      : `<g transform="translate(${x + TILE_W / 2 - 20} ${y + 18}) scale(${40 / 24})"><path d="${pathOf(slug)}" fill="${ink}"/></g>`;

  return `<g><rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="10" fill="${t.card}" stroke="${t.border}"/>${mark}<text x="${x + TILE_W / 2}" y="${y + 80}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="${t.text}">${esc(name)}</text><text x="${x + TILE_W / 2}" y="${y + 99}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${t.muted}">${esc(version)}</text></g>`;
}

for (const [name, t] of Object.entries(THEMES)) {
  let y = PAD;
  const parts = [];

  for (const group of GROUPS) {
    parts.push(`<rect x="${PAD}" y="${y + 2}" width="3" height="14" fill="${t.tick}"/><text x="${PAD + 12}" y="${y + 14}" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="1.3" fill="${t.muted}">${group.title.toUpperCase()}</text>`);
    y += 30;

    group.items.forEach((item, i) => {
      const col = i % PER_ROW;
      const row = Math.floor(i / PER_ROW);

      parts.push(tile(PAD + col * (TILE_W + GAP), y + row * (TILE_H + GAP), item, t));
    });

    y += Math.ceil(group.items.length / PER_ROW) * (TILE_H + GAP) + 18;
  }

  const h = y + PAD - 18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="Technology stack"><rect width="${W}" height="${h}" rx="16" fill="${t.bg}"/>${parts.join("")}</svg>\n`;

  writeFileSync(`${DIR}/stack-${name}.svg`, svg);
}

console.log("stack images written");
