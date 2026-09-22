import { APP, expect, expectAccessible, setTheme, test } from "./support/fixtures";

test.describe("web", () => {
  test("navigates the football surfaces from a header built from platform data", async ({ page }) => {
    await page.goto(APP.web);

    const primary = page.getByRole("navigation", { name: "Primary" });

    for (const name of ["Football", "Live", "Virtuals", "Results", "Standings"]) {
      await expect(primary.getByRole("link", { name, exact: true })).toBeVisible();
    }

    const competitions = page.getByRole("navigation", { name: "Competitions" });

    await expect(competitions.getByText(/live now/i)).toBeVisible();
    expect(await competitions.getByRole("link").count()).toBeGreaterThan(1);

    await primary.getByRole("link", { name: "Live", exact: true }).click();
    await expect(page).toHaveURL(/\/live$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/live/i);

    await competitions.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/\/leagues\//);

    await expect(page.getByRole("contentinfo")).toContainText(/simulated/i);
  });

  test("searches through the platform and opens a result", async ({ page }) => {
    await page.goto(APP.web);
    await page.getByRole("banner").getByRole("button", { name: /search/i }).click();

    const box = page.getByPlaceholder("Search BETNG");

    await expect(box).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();
    await page.keyboard.press("Control+k");
    await expect(box).toBeFocused();
    await box.fill("ar");

    const results = page.getByRole("listbox", { name: "Search results" }).or(page.getByLabel("Search results"));

    await expect(results.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(new RegExp(`^${APP.web}/?$`));
  });

  test("shows a live match centre whose minute, score and events come from the platform", async ({ page }) => {
    await page.goto(`${APP.web}/live`);
    await page.locator('a[href^="/matches/"]').first().click();
    await expect(page).toHaveURL(/\/matches\/[^/?]+/);

    const tabs = page.getByRole("tablist").first();

    for (const name of ["Overview", "Timeline", "Stats", "Lineups", "Markets", "Head to Head", "Table"]) {
      await expect(tabs.getByRole("tab", { name: new RegExp(`^${name}`) })).toBeVisible();
    }

    await tabs.getByRole("tab", { name: /^Timeline/ }).click();
    await expect(page).toHaveURL(/tab=timeline/);
    await expect(page.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();

    await tabs.getByRole("tab", { name: /^Lineups/ }).click();
    await expect(page.getByRole("tabpanel", { name: "Lineups" })).toContainText(/starting|lineup|not yet|unavailable/i);
  });

  test("takes a bet from a price to a platform-accepted ticket, asking for sign-in on the way and keeping the slip", async ({ page }) => {
    await page.goto(`${APP.web}/virtuals`);

    // The latest kick-off on the page, held by handle: earlier matches close and reorder the list mid-test.
    const prices = page.getByRole("main").locator("button[aria-pressed]:not([disabled])");

    await expect(prices.first()).toBeVisible();

    const price = await prices.last().elementHandle();

    await price?.click();
    expect(await price?.getAttribute("aria-pressed")).toBe("true");

    const slip = page.getByRole("complementary", { name: "Bet slip" });

    await expect(slip.getByText(/estimated return/i).first()).toBeVisible();
    await slip.getByRole("button", { name: "Sign in to place bet" }).click();

    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Email").fill("demo@betng.test");
    await dialog.getByLabel("Password", { exact: true }).fill("betng-demo");
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

    // Prices move while betting is open. The slip must stop and ask rather than place at a price the user did not see.
    await expect(async () => {
      const accept = slip.getByRole("button", { name: "Accept new prices" });
      const place = slip.getByRole("button", { name: "Place bet" });

      // After sign-in the slip resumes the placement itself; only press what is ready to be pressed.
      for (const button of [accept, place]) {
        const ready = (await button.isVisible()) && (await button.isEnabled({ timeout: 500 }).catch(() => false));

        if (ready) await button.click({ timeout: 2_000 }).catch(() => undefined);
      }

      // Accepted, limited and partially accepted all end on a platform-issued bet.
      await expect(slip.getByRole("button", { name: "View ticket" }).or(slip.getByRole("link", { name: "View ticket" }))).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });

    await expect(slip.getByText(/potential payout/i).first()).toBeAttached();
    await expect(slip.getByText(/reference/i).first()).toBeAttached();

    await page.goto(`${APP.web}/tickets`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText(/pending|open/i).first()).toBeVisible();

    await page.goto(`${APP.web}/transactions`);
    await expect(page.getByRole("main").getByText(/stake/i).first()).toBeVisible();
  });

  test("keeps results and standings filters in the URL", async ({ page }) => {
    await page.goto(`${APP.web}/standings`);
    await expect(page.getByRole("table").first()).toBeVisible();

    const league = page.getByRole("combobox").first();
    const options = await league.locator("option").all();

    if (options.length > 1) {
      await league.selectOption({ index: 1 });
      await expect(page).toHaveURL(/league=/);
      await page.reload();
      await expect(page).toHaveURL(/league=/);
      await expect(page.getByRole("table").first()).toBeVisible();
    }

    await page.goto(`${APP.web}/results`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("gates private pages behind sign-in without losing the address, and answers an unknown address with a 404", async ({ page }) => {
    await page.goto(`${APP.web}/wallet`);
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByRole("main").getByRole("button", { name: /sign in/i }).first()).toBeVisible();

    await page.goto(`${APP.web}/nowhere/at-all`);
    await expect(page.getByRole("main")).toContainText(/not found|doesn.t exist|404/i);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations on home and a match in the ${theme} theme`, async ({ page }) => {
      await page.goto(APP.web);
      await setTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('a[href^="/matches/"]').first()).toBeVisible();
      await expectAccessible(page);

      await page.locator('a[href^="/matches/"]').first().click();
      await expect(page.getByRole("tablist").first()).toBeVisible();
      await expectAccessible(page);
    });
  }
});
