// Renders a captured command log as a terminal image, so documentation can show real output.
// node scripts/docs/render-terminal.mjs --log run.log --out docs/images/proof/x.png --command "pnpm verify" [--include regex] [--exclude regex] [--note text]
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => (index % 2 === 0 ? [...pairs, [value.replace(/^--/, ""), all[index + 1]]] : pairs), []),
);

const PALETTE = { 30: "#6E7681", 31: "#FF6B6B", 32: "#3FD68F", 33: "#F0C24B", 34: "#6EA2FF", 35: "#C48CFF", 36: "#4FC3E0", 37: "#E6E8EB", 90: "#8690A0", 91: "#FF8A8A", 92: "#5BE3A3", 93: "#F7D774", 94: "#8FB6FF", 95: "#D5A6FF", 96: "#7AD6EC", 97: "#FFFFFF" };
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ansiToHtml(line) {
  let out = "";
  let open = 0;
  let style = {};

  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    const code = /^\x1b\[([0-9;]*)m$/.exec(part);

    if (code === null) {
      out += escapeHtml(part);
      continue;
    }

    for (const n of (code[1] === "" ? "0" : code[1]).split(";").map(Number)) {
      if (n === 0 || n === 39) style = n === 0 ? {} : { ...style, color: undefined };
      else if (n === 1) style.bold = true;
      else if (n === 2) style.dim = true;
      else if (n === 22) style = { ...style, bold: false, dim: false };
      else if (PALETTE[n] !== undefined) style.color = PALETTE[n];
    }

    out += "</span>".repeat(open);
    open = 1;
    out += `<span style="${style.color === undefined ? "" : `color:${style.color};`}${style.bold ? "font-weight:700;" : ""}${style.dim ? "opacity:.6;" : ""}">`;
  }

  return out + "</span>".repeat(open);
}

const include = args.include === undefined ? undefined : new RegExp(args.include);
const exclude = args.exclude === undefined ? undefined : new RegExp(args.exclude);
const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, "");
const lines = readFileSync(args.log, "utf8")
  .replace(/\r/g, "")
  .split("\n")
  .filter((line) => plain(line).trim() !== "" || include === undefined)
  .filter((line) => include === undefined || include.test(plain(line)))
  .filter((line) => exclude === undefined || !exclude.test(plain(line)))
  .slice(0, Number(args.max ?? 80));

while (lines.length > 0 && plain(lines.at(-1)).trim() === "") lines.pop();

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:transparent;font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif}
.win{display:inline-block;min-width:900px;max-width:1400px;background:#0A0C10;border:1px solid #222732;border-radius:12px;overflow:hidden}
.bar{display:flex;align-items:center;gap:10px;padding:12px 18px;background:#12151B;border-bottom:1px solid #222732;color:#8690A0;font-size:13px}
.tick{width:3px;height:14px;background:#4C7DFF}
.cmd{color:#F2F4F7;font-family:'JetBrains Mono','DejaVu Sans Mono',Menlo,Consolas,monospace;font-size:13px}
.when{margin-left:auto}
pre{margin:0;padding:16px 18px 18px;color:#E6E8EB;font:13px/1.55 'JetBrains Mono','DejaVu Sans Mono',Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
.note{padding:0 18px 14px;color:#8690A0;font-size:12px}
</style></head><body><div class="win" id="win"><div class="bar"><span class="tick"></span><span>BETNG</span><span class="cmd">$ ${escapeHtml(args.command ?? "")}</span><span class="when">${escapeHtml(args.when ?? "")}</span></div><pre>${lines.map(ansiToHtml).join("\n")}</pre>${args.note === undefined ? "" : `<div class="note">${escapeHtml(args.note)}</div>`}</div></body></html>`;

const SYSTEM = "/usr/bin/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(SYSTEM) ? { executablePath: SYSTEM } : {}) });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1460, height: 900 } });

await page.setContent(html);
await page.locator("#win").screenshot({ path: args.out, omitBackground: true });
await browser.close();
console.log(`${args.out} (${String(lines.length)} lines)`);
