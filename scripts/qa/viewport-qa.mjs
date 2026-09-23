/*
 * Viewport QA for the Shop and TV terminals.
 *
 * The Shop and TV shells promise to hold one screen: the page itself must not
 * scroll, and what scrolls instead is a named panel inside it. That promise is
 * a measurement, not a matter of taste, so this drives a real browser at the
 * sizes real terminals report and records what it finds.
 *
 * It writes screenshots and a JSON summary. It asserts nothing: the report is
 * the output, so a regression shows up as a changed number rather than as a
 * failure nobody can see.
 *
 * Usage: node scripts/qa/viewport-qa.mjs [--out docs/images/qa]
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const SYSTEM_CHROMIUM = "/usr/bin/chromium";

/*
 * Playwright writes PNG; docs/images is webp. Converted through Pillow, which
 * the Python services already depend on, so this adds no new tooling.
 */
function toWebp(file) {
  const png = `${file}.tmp.png`;

  renameSync(file, png);
  execFileSync("python3", [
    "-c",
    [
      "import sys",
      "from PIL import Image",
      "im = Image.open(sys.argv[1]).convert('RGB')",
      "im = im.resize((2200, round(im.height * 2200 / im.width))) if im.width > 2200 else im",
      "im.save(sys.argv[2], 'WEBP', quality=82, method=6)",
    ].join("\n"),
    png,
    file,
  ]);
  execFileSync("rm", ["-f", png]);
}

const APPS = {
  web: "http://127.0.0.1:4200",
  tv: "http://127.0.0.1:4300",
  shop: "http://127.0.0.1:4400",
};

/*
 * `locked` surfaces must not produce a page scrollbar at any size. The public
 * web is deliberately not locked: long content there scrolls normally.
 */
const CASES = [
  { app: "shop", path: "/", label: "shop-1024x600", width: 1024, height: 600, locked: true },
  { app: "shop", path: "/", label: "shop-1280x720", width: 1280, height: 720, locked: true },
  { app: "shop", path: "/", label: "shop-1366x768", width: 1366, height: 768, locked: true },
  { app: "shop", path: "/", label: "shop-1920x1080", width: 1920, height: 1080, locked: true },
  { app: "shop", path: "/", label: "shop-2560x1440", width: 2560, height: 1440, locked: true },
  { app: "tv", path: "/", label: "tv-1280x720", width: 1280, height: 720, locked: true },
  { app: "tv", path: "/", label: "tv-1920x1080", width: 1920, height: 1080, locked: true },
  { app: "tv", path: "/", label: "tv-2560x1440", width: 2560, height: 1440, locked: true },
  { app: "tv", path: "/", label: "tv-3840x2160", width: 3840, height: 2160, locked: true },
  { app: "web", path: "/football", label: "web-football-1920x1080", width: 1920, height: 1080, locked: false },
  { app: "web", path: "/football", label: "web-football-1366x768", width: 1366, height: 768, locked: false },
  { app: "web", path: "/football", label: "web-football-390x844", width: 390, height: 844, locked: false },
  { app: "web", path: "/football", label: "web-football-320x568", width: 320, height: 568, locked: false },
];

/*
 * The numbers that decide whether a shell kept its promise. `pageScroll` is
 * the one that matters: anything above a rounding pixel means the document
 * itself grew past the viewport.
 */
const MEASURE = `(() => {
  const d = document.documentElement;
  const scrollers = [...document.querySelectorAll("*")]
    .filter((el) => {
      const s = getComputedStyle(el);
      const scrolls = /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflowX);
      return scrolls && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    })
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      label: el.getAttribute("aria-label") ?? el.id ?? el.className.toString().slice(0, 48),
      overflowY: el.scrollHeight - el.clientHeight,
    }));

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    pageScrollY: Math.max(0, d.scrollHeight - window.innerHeight),
    pageScrollX: Math.max(0, d.scrollWidth - window.innerWidth),
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    density: document.querySelector("[data-density]")?.getAttribute("data-density") ?? null,
    rootFontPx: parseFloat(getComputedStyle(d).fontSize),
    innerScrollers: scrollers,
  };
})()`;

function outDir() {
  const flag = process.argv.indexOf("--out");
  const dir = flag === -1 ? "docs/images/qa" : process.argv[flag + 1];

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  return dir;
}

async function main() {
  const dir = outDir();
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--force-device-scale-factor=1"],
    ...(existsSync(SYSTEM_CHROMIUM) ? { executablePath: SYSTEM_CHROMIUM } : {}),
  });

  const results = [];

  for (const testCase of CASES) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const consoleErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 160));
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(`pageerror: ${String(error).slice(0, 160)}`);
    });

    const url = `${APPS[testCase.app]}${testCase.path}`;

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    } catch {
      // The platform is not running in this QA, so network idle may never
      // settle. The layout is still what is being measured.
      await page.waitForTimeout(2500);
    }

    await page.waitForTimeout(1200);

    const measured = await page.evaluate(MEASURE);
    /*
     * webp to match the rest of docs/images, and because a 4K PNG is several
     * megabytes of repository for a picture nobody zooms into.
     */
    const file = join(dir, `${testCase.label}.webp`);

    await page.screenshot({ path: file, type: "png" });
    await toWebp(file);

    results.push({
      ...testCase,
      url,
      ...measured,
      // A locked shell is only correct when the page itself did not grow.
      pageScrollOk: !testCase.locked || (measured.pageScrollY <= 1 && measured.pageScrollX <= 1),
      consoleErrors: [...new Set(consoleErrors)].slice(0, 5),
      screenshot: file,
    });

    await context.close();
  }

  await browser.close();

  const summary = {
    capturedAt: new Date().toISOString(),
    note: "Layout QA only: the platform backend was not running, so pages render their empty and error states.",
    results,
  };

  writeFileSync(join(dir, "viewport-qa.json"), `${JSON.stringify(summary, null, 2)}\n`);

  for (const r of results) {
    const verdict = r.pageScrollOk ? "ok" : "PAGE SCROLLS";
    const density = r.density === null ? "" : ` density=${r.density}`;
    console.log(
      `${r.label.padEnd(26)} ${verdict.padEnd(12)} pageScrollY=${String(r.pageScrollY).padStart(5)} rootFont=${r.rootFontPx}px${density} innerScrollers=${r.innerScrollers.length} errors=${r.consoleErrors.length}`,
    );
  }

  const failed = results.filter((r) => !r.pageScrollOk);

  console.log(`\n${String(results.length - failed.length)}/${String(results.length)} viewports hold one screen.`);
  console.log(`Screenshots and viewport-qa.json written to ${dir}`);
}

await main();
