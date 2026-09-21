import type { Page } from "@playwright/test";
import { APP, expect, expectAccessible, setTheme, test } from "./support/fixtures";

const PASSWORD = "betng-admin";
const FORBIDDEN = /choose winner|force winner|set winner|pick winner|set score|set result|manipulate|override result/i;

async function signIn(page: Page, email: string, code?: string): Promise<void> {
  await page.goto(APP.admin);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // The code form submits itself once six digits are in.
  if (code !== undefined) await page.getByLabel("Authentication code").fill(code);

  await expect(page.getByRole("navigation").first()).toBeVisible();
}

const AREAS = [
  "Dashboard", "Users", "Shops", "Cashiers", "Leagues", "Teams", "Fixtures", "Matches", "Markets", "Odds", "Risk",
  "Live Control", "Simulation", "Settlement", "Wallet", "Reports", "Audit Logs", "System Health", "Settings",
];

test.describe("admin", () => {
  test("requires the second factor where the account has one", async ({ page }) => {
    await page.goto(APP.admin);
    await page.getByLabel("Work email").fill("ops@betng.test");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByLabel("Authentication code")).toBeVisible();
    await expect(page.getByRole("navigation", { name: /main|admin|sections/i })).toHaveCount(0);
  });

  test("opens every area of the control plane, and none offers a control that decides a result", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, "ops@betng.test", "246810");

    for (const area of AREAS) {
      await page.getByRole("link", { name: area, exact: true }).first().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText(/something went wrong/i);

      const controls = await page.getByRole("main").locator("button, a, [role=menuitem], option").allInnerTexts();

      expect(controls.filter((label) => FORBIDDEN.test(label)), `forbidden controls on ${area}`).toEqual([]);
    }
  });

  test("hides areas a support role may not read and refuses them on a direct address", async ({ page }) => {
    await signIn(page, "support@betng.test");

    await expect(page.getByRole("link", { name: "Risk", exact: true })).toHaveCount(0);
    await page.goto(`${APP.admin}/risk`);
    await expect(page.getByRole("main")).toContainText(/permission|not allowed|access/i);
  });

  test("puts a destructive action behind a confirmation that needs a reason", async ({ page }) => {
    await signIn(page, "ops@betng.test", "246810");
    await page.getByRole("link", { name: "Shops", exact: true }).first().click();
    await page.getByRole("button", { name: /^Actions for / }).first().click();
    await page.getByRole("menuitem", { name: "Suspend" }).click();

    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Suspend shop" });

    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("End-to-end check of the confirmation");
    await expect(confirm).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations on the dashboard in the ${theme} theme`, async ({ page }) => {
      await signIn(page, "operations@betng.test");
      await setTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page);
    });
  }
});
