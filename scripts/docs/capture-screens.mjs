// Captures documentation screenshots of the four browser apps running against a real platform.
// Start the apps in platform mode on localhost:4200-4500 first. Usage: node scripts/docs/capture-screens.mjs <outDir>
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const OUT = process.argv[2] ?? "docs/images/screens";
const WEB = "http://localhost:4200";
const TV = "http://localhost:4300";
const SHOP = "http://localhost:4400";
const ADMIN = "http://localhost:4500";
const TOTP_SECRET = process.env.ADMIN_TOTP_SECRET ?? "BETNGDEVSEEDTOTPSECRET234567AAAA";
const problems = [];
const shots = [];

function totp(secret, now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const ch of secret.replace(/=+$/, "")) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");

  const key = Buffer.from(bits.match(/.{8}/g).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));

  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1] & 0xf;

  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}) });

async function context(options, theme = "light") {
  const ctx = await browser.newContext({ colorScheme: theme, ...options });

  await ctx.addInitScript((value) => {
    try {
      localStorage.setItem("betng.theme", value);
    } catch {
      /* private mode */
    }
  }, theme);

  const page = await ctx.newPage();

  page.on("console", (m) => {
    if (m.type() === "error" && !/Download the React DevTools/.test(m.text())) problems.push(`${page.url()}: ${m.text().slice(0, 180)}`);
  });
  page.on("pageerror", (e) => problems.push(`${page.url()}: ${e.message.slice(0, 180)}`));

  return { ctx, page };
}

async function shot(page, name, { settle = 1800, fullPage = false } = {}) {
  const dir = `${OUT}/${name.split("/")[0]}`;

  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  shots.push(name);
}

async function step(label, run) {
  try {
    await run();
  } catch (error) {
    problems.push(`${label}: ${error.message.split("\n")[0]}`);
  }
}

const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { ...devices["iPhone 13"] };

async function webSignIn(page) {
  await page.goto(`${WEB}/login`);
  await page.getByLabel("Email").fill("demo@betng.test");
  await page.getByLabel("Password", { exact: true }).fill("betng-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

for (const theme of ["light", "dark"]) {
  const { ctx, page } = await context(desktop, theme);

  await step(`web ${theme}`, async () => {
    await page.goto(WEB);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shot(page, `web/home-${theme}`);

    if (theme === "light") await shot(page, "web/home-full", { fullPage: true });

    await page.goto(`${WEB}/live`);
    await page.getByRole("heading", { level: 1, name: /live/i }).waitFor();
    await shot(page, `web/live-${theme}`);

    await page.locator('a[href^="/matches/"]').first().click();
    await page.getByRole("tablist").first().waitFor();
    await shot(page, `web/match-overview-${theme}`);

    if (theme === "light") {
      for (const tab of ["timeline", "stats", "lineups", "markets", "h2h"]) {
        await page.goto(`${page.url().split("?")[0]}?tab=${tab}`);
        await page.getByRole("tabpanel").first().waitFor();
        await shot(page, `web/match-${tab}`);
      }

      await page.goto(`${WEB}/virtuals`);
      await page.getByRole("heading", { level: 1, name: /virtual/i }).waitFor();
      await shot(page, "web/virtuals");
      await page.goto(`${WEB}/results`);
      await page.getByRole("heading", { level: 1, name: /results/i }).waitFor();
      await shot(page, "web/results");
      await page.goto(`${WEB}/standings`);
      await page.getByRole("table").first().waitFor();
      await shot(page, "web/standings");
      await page.goto(WEB);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.keyboard.press("Control+k");
      await page.getByPlaceholder("Search BETNG").fill("ars");
      await page.getByRole("option").first().waitFor();
      await shot(page, "web/search");
      await page.keyboard.press("Escape");
    }
  });

  if (theme === "light") {
    await step("web signed in", async () => {
      await webSignIn(page);
      await page.goto(`${WEB}/virtuals`);

      const prices = page.getByRole("main").locator("button[aria-pressed]:not([disabled])");

      await prices.first().waitFor();
      await (await prices.last().elementHandle()).click();
      await page.getByRole("complementary", { name: "Bet slip" }).getByRole("button", { name: "₦100", exact: true }).click().catch(() => undefined);
      await shot(page, "web/betslip-ready");

      const slip = page.getByRole("complementary", { name: "Bet slip" });

      for (let i = 0; i < 20; i += 1) {
        if ((await slip.getByRole("link", { name: "View ticket" }).count()) > 0) break;

        for (const name of ["Accept new prices", "Place bet"]) {
          const button = slip.getByRole("button", { name });

          if ((await button.isVisible()) && (await button.isEnabled({ timeout: 500 }).catch(() => false))) await button.click({ timeout: 2000 }).catch(() => undefined);
        }

        await page.waitForTimeout(1000);
      }

      await shot(page, "web/betslip-accepted");
      await page.goto(`${WEB}/tickets`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "web/tickets");
      await page.goto(`${WEB}/wallet`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "web/wallet");
      await page.goto(`${WEB}/transactions`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "web/transactions");
      await page.goto(`${WEB}/notifications`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "web/notifications");
      await page.goto(`${WEB}/account/profile`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "web/account");
    });
  }

  await ctx.close();
}

for (const theme of ["light", "dark"]) {
  const { ctx, page } = await context(phone, theme);

  await step(`mobile ${theme}`, async () => {
    await page.goto(WEB);
    await page.locator('a[href^="/matches/"]').first().waitFor();
    await shot(page, `mobile/home-${theme}`);

    const nav = page.getByRole("navigation", { name: "Main" });

    await nav.getByRole("link", { name: "Live" }).click();
    await page.getByRole("heading", { level: 1, name: /^live$/i }).waitFor();
    await shot(page, `mobile/live-${theme}`);

    if (theme === "light") {
      await page.locator('a[href^="/matches/"]').first().click();
      await page.getByRole("tablist").first().waitFor();
      await shot(page, "mobile/match");
      await page.goto(`${WEB}/standings`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "mobile/standings");
      await page.goto(`${WEB}/virtuals`);
      await page.getByRole("heading", { level: 1, name: /virtual/i }).waitFor();

      const prices = page.getByRole("main").locator("button[aria-pressed]:not([disabled])");

      await prices.first().waitFor();
      await prices.last().click();
      await shot(page, "mobile/slip-bar");
      await page.getByRole("button", { name: /selection/i }).first().click();
      await page.getByRole("dialog").waitFor();
      await shot(page, "mobile/slip-sheet");
      await page.keyboard.press("Escape");
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "More" }).click();
      await page.getByRole("dialog").waitFor();
      await shot(page, "mobile/more-sheet");
    }
  });

  await ctx.close();
}

{
  const { ctx, page } = await context({ viewport: { width: 1920, height: 1080 } }, "dark");

  await step("tv", async () => {
    for (const [route, name] of [["/", "home"], ["/board", "board"], ["/live", "live"], ["/results", "results"], ["/standings", "standings"], ["/upcoming", "upcoming"], ["/broadcast", "broadcast"]]) {
      await page.goto(`${TV}${route}`);
      await page.locator("main, [role=main]").first().waitFor();
      await shot(page, `tv/${name}`, { settle: 3500 });
    }

    await page.goto(`${TV}/live`);

    const match = page.locator('a[href^="/match/"], a[href^="/live/"]').first();

    if ((await match.count()) > 0) {
      await match.click();
      await shot(page, "tv/match", { settle: 3500 });
    }
  });

  await ctx.close();
}

for (const theme of ["light", "dark"]) {
  const { ctx, page } = await context(desktop, theme);

  await step(`shop ${theme}`, async () => {
    await page.goto(SHOP);
    await page.getByLabel("Shop code").waitFor();

    if (theme === "light") await shot(page, "shop/login");

    await page.getByLabel("Shop code").fill("BNG-LAG-001");
    await page.getByLabel("Username").fill("bisi");
    await page.getByLabel("Password", { exact: true }).fill("betng-demo");
    await page.getByLabel("Cashier PIN").fill("1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("navigation").first().waitFor();
    await shot(page, `shop/dashboard-${theme}`);
    await page.getByRole("link", { name: /^Virtual Football/ }).first().click();

    const cells = page.getByRole("table").first().locator("button[aria-pressed]:not([disabled])");

    await cells.first().waitFor({ timeout: 60_000 });
    await shot(page, `shop/week-grid-${theme}`);

    if (theme === "light") {
      await cells.nth(2).click();
      await cells.nth(10).click().catch(() => undefined);
      await shot(page, "shop/slip");
      await page.getByRole("button", { name: "Review ticket" }).click();
      await page.getByRole("button", { name: /^Take .+ and issue ticket$/ }).click();
      await page.waitForURL(/\/tickets\//);
      await shot(page, "shop/ticket");

      const code = new URL(page.url()).pathname.split("/").pop();

      await page.getByRole("link", { name: /^Check Ticket/ }).click();
      await page.getByRole("textbox").fill(code);
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await shot(page, "shop/check-ticket");
    }
  });

  await ctx.close();
}

for (const theme of ["light", "dark"]) {
  const { ctx, page } = await context(desktop, theme);

  await step(`admin ${theme}`, async () => {
    await page.goto(ADMIN);
    await page.getByLabel("Work email").waitFor();

    if (theme === "light") await shot(page, "admin/login");

    await page.getByLabel("Work email").fill("ops@betng.test");
    await page.getByLabel("Password", { exact: true }).fill("betng-admin");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Authentication code").fill(totp(TOTP_SECRET));
    await page.getByRole("link", { name: "Risk", exact: true }).first().waitFor();
    await shot(page, `admin/dashboard-${theme}`, { settle: 3000 });

    const routes = theme === "light"
      ? [["/matches", "matches"], ["/risk", "risk"], ["/simulation", "simulation"], ["/settlement", "settlement"], ["/wallet", "wallet"], ["/reports", "reports"], ["/audit", "audit"], ["/health", "health"], ["/users", "users"], ["/shops", "shops"]]
      : [["/risk", "risk-dark"]];

    for (const [route, name] of routes) {
      await page.goto(`${ADMIN}${route}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, `admin/${name}`, { settle: 2500 });
    }

    if (theme === "light") {
      await page.goto(`${ADMIN}/matches`);
      await page.locator('a[href^="/matches/"], tr[tabindex]').first().click();
      await page.waitForURL(/\/matches\/[^/]+/);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot(page, "admin/match-control", { settle: 2500 });
    }
  });

  await ctx.close();
}

await browser.close();
console.log(`${String(shots.length)} screenshots`);
console.log(problems.length === 0 ? "no problems" : problems.join("\n"));
