import { APP, expect, expectAccessible, expectNoHorizontalScroll, test } from "./support/fixtures";

test.describe("web on a phone", () => {
  test("uses bottom navigation and fits the viewport on every main surface", async ({ page }) => {
    await page.goto(APP.web);

    const bottom = page.getByRole("navigation", { name: "Main" });

    for (const name of ["Home", "Live", "Virtuals", "Bets", "More"]) {
      await expect(bottom.getByRole("link", { name }).or(bottom.getByRole("button", { name }))).toBeVisible();
    }

    await expect(page.locator('a[href^="/matches/"]').first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Routes load lazily: the address changes first and the previous page stays until the new one arrives.
    for (const [name, heading] of [["Live", /^live$/i], ["Virtuals", /virtual football/i]] as const) {
      await bottom.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }

    await bottom.getByRole("button", { name: "More" }).click();

    const sheet = page.getByRole("dialog");

    for (const name of ["Results", "Standings", "Wallet", "Account", "Help"]) {
      await expect(sheet.getByRole("link", { name, exact: true })).toBeVisible();
    }

    await sheet.getByRole("link", { name: "Standings", exact: true }).click();
    await expect(page).toHaveURL(/\/standings/);
    await expectNoHorizontalScroll(page);
  });

  test("keeps the slip one tap away: a sticky bar that opens a bottom sheet", async ({ page }) => {
    await page.goto(`${APP.web}/virtuals`);

    const prices = page.getByRole("main").locator("button[aria-pressed]:not([disabled])");

    await expect(prices.first()).toBeVisible();
    await prices.last().click();

    const bar = page.getByRole("button", { name: /selection/i }).first();

    await expect(bar).toBeVisible();
    await bar.click();

    const sheet = page.getByRole("dialog");

    await expect(sheet.getByText(/estimated return/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: /place bet/i })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("gives touch targets room and passes accessibility checks on the live page", async ({ page }) => {
    await page.goto(`${APP.web}/live`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const small = await page.getByRole("navigation", { name: "Main" }).locator("a, button").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect()).filter((box) => box.height < 44 || box.width < 44).length,
    );

    expect(small).toBe(0);
    await expectAccessible(page);
  });

  test("fits the smallest supported phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    for (const route of ["/", "/live", "/virtuals", "/results", "/standings"]) {
      await page.goto(`${APP.web}${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
});
