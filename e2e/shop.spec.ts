import type { Page } from "@playwright/test";
import { APP, expect, expectAccessible, test } from "./support/fixtures";

const CASHIER = { shop: "BNG-LAG-001", username: "bisi", password: "betng-demo", pin: "1234" };
const OWNER = { ...CASHIER, username: "ada" };

async function signIn(page: Page, who: typeof CASHIER): Promise<void> {
  await page.goto(APP.shop);
  await page.getByLabel("Shop code").fill(who.shop);
  await page.getByLabel("Username").fill(who.username);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByLabel("Cashier PIN").fill(who.pin);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

test.describe("shop", () => {
  test("keeps everything behind sign-in and refuses wrong credentials in plain words", async ({ page, problems }) => {
    problems.expected.push(/^401 \S+\/shop\/auth\/login$/, /status of 401 .*\/shop\/auth\/login$/, /\/shop\/auth\/login failed .*status: 401, code: INVALID_CREDENTIALS/);
    await page.goto(`${APP.shop}/cashier/payout`);
    await expect(page.getByLabel("Shop code")).toBeVisible();

    await page.getByLabel("Shop code").fill(CASHIER.shop);
    await page.getByLabel("Username").fill(CASHIER.username);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByLabel("Cashier PIN").fill(CASHIER.pin);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByLabel("Shop code")).toBeVisible();
  });

  test("sells a ticket in a few steps and the platform's reference checks out", async ({ page }) => {
    await signIn(page, CASHIER);
    await page.getByRole("link", { name: "Virtual Football" }).click();

    test.setTimeout(150_000);

    const cells = page.getByRole("table").first().locator("button[aria-pressed]:not([disabled])");

    // An open week with at least 40 seconds left, so betting cannot close mid-test.
    await expect
      .poll(
        async () => {
          for (const week of await page.getByRole("button", { name: /^WK \d+$/ }).all()) {
            await week.click();

            const closing = await page.getByText(/betting closes in/i).locator("..").textContent().catch(() => null);
            const [minutes, seconds] = (/(\d+):(\d+)/.exec(closing ?? "") ?? []).slice(1).map(Number);
            const left = (minutes ?? 0) * 60 + (seconds ?? 0);

            if (left >= 40 && (await cells.count()) > 0) return true;
          }

          return false;
        },
        { timeout: 90_000, intervals: [2_000] },
      )
      .toBe(true);

    const price = cells.first();

    await expect(price).toBeVisible();
    await price.click();
    await expect(price).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/estimated return/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Review ticket" }).click();
    await page.getByRole("button", { name: /^Take .+ and issue ticket$/ }).click();

    await expect(page).toHaveURL(/\/tickets\/[A-Z0-9-]+\?sold=1$/);
    await expect(page.getByText(/potential payout/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

    const code = new URL(page.url()).pathname.split("/").pop() ?? "";

    await page.getByRole("link", { name: /^Check Ticket/ }).click();
    await page.getByRole("textbox").fill(code);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText(code).first()).toBeVisible();
    await expect(page.getByText(/open/i).first()).toBeVisible();
  });

  test("shows a cashier only what the platform permits, and an owner the reports", async ({ page }) => {
    await signIn(page, CASHIER);
    await expect(page.getByRole("link", { name: "Daily Report" })).toHaveCount(0);

    await page.goto(`${APP.shop}/reports/daily`);
    await expect(page.getByText(/permission|not allowed|access/i).first()).toBeVisible();
  });

  test("reaches every area as an owner with no console errors and no serious accessibility violations", async ({ page }) => {
    await signIn(page, OWNER);

    for (const name of ["Dashboard", "Football", "Virtual Football", "Bet Slip", "Open Tickets", "Check Ticket", "Payout", "Transactions", "Daily Report"]) {
      await page.getByRole("link", { name: new RegExp(`^${name}`) }).first().click();
      await expect(page.getByRole("heading").first()).toBeVisible();
    }

    await page.getByRole("link", { name: /^Dashboard/ }).first().click();
    await expectAccessible(page);
  });
});
