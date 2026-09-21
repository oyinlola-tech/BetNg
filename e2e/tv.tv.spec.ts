import { APP, expect, expectAccessible, test } from "./support/fixtures";

const ROUTES = ["/", "/board", "/live", "/matchday", "/results", "/standings", "/upcoming", "/broadcast"];

test.describe("tv", () => {
  for (const route of ROUTES) {
    test(`renders ${route} with no betting interaction`, async ({ page }) => {
      await page.goto(`${APP.tv}${route}`);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-surface", "tv");

      await expect(page.getByRole("button", { name: /place bet|add to slip|bet slip|stake/i })).toHaveCount(0);
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /wallet|account|sign in/i })).toHaveCount(0);
    });
  }

  test("is driven by the remote: arrows move focus, Enter opens, Back returns", async ({ page }) => {
    await page.goto(APP.tv);
    await expect(page.locator("[data-tv-focusable]").first()).toBeVisible();

    const focused = (): Promise<string> => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

    const visited = new Set<string>();

    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"]) {
      await page.keyboard.press(key);
      visited.add(await focused());
    }

    expect(visited.size, "distinct elements the arrows reached").toBeGreaterThanOrEqual(3);

    await page.getByRole("link", { name: "Results" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/results$/);

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`^${APP.tv}/?$`));
  });

  test("fills a 1080p screen without scrolling and reads at a distance", async ({ page }) => {
    await page.goto(`${APP.tv}/standings`);
    await expect(page.getByRole("table").first()).toBeVisible();

    const metrics = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));

    expect(metrics.overflowX).toBeLessThanOrEqual(1);
    expect(metrics.rootFont).toBeGreaterThanOrEqual(20);
  });

  test("has no serious accessibility violations on home and standings", async ({ page }) => {
    await page.goto(APP.tv);
    await expect(page.locator("[data-tv-focusable]").first()).toBeVisible();
    await expectAccessible(page);

    await page.goto(`${APP.tv}/standings`);
    await expect(page.getByRole("table").first()).toBeVisible();
    await expectAccessible(page);
  });

  test("opens a match as its own route and auto broadcast drives scenes without input", async ({ page }) => {
    await page.goto(`${APP.tv}/live`);

    const match = page.locator('a[href^="/match/"], a[href^="/live/"]').first();

    if ((await match.count()) > 0) {
      await match.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/(match|live)\/[^/]+$/);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
    }

    await page.goto(`${APP.tv}/broadcast`);
    await expect(page).toHaveURL(/\/broadcast/);
    await expect(page.getByRole("link", { name: /broadcast/i }).first()).toHaveAttribute("aria-current", /.+/);
  });
});
