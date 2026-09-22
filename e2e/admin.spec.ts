import type { Page } from "@playwright/test";
import { APP, expect, expectAccessible, setTheme, test, type PageProblems } from "./support/fixtures";
import { nextAdminCode } from "./support/platform";

const PASSWORD = "betng-admin";

/* A two-factor account's first sign-in step is answered 422 with the code field named; the form then asks for the code. */
function expectCodeRequest(problems: PageProblems): void {
  problems.expected.push(/^422 \S+\/admin\/auth\/login$/, /status of 422 .*\/admin\/auth\/login$/, /\/admin\/auth\/login failed .*status: 422, code: VALIDATION_FAILED/);
}
const FORBIDDEN = /choose winner|force winner|set winner|pick winner|set score|set result|manipulate|override result/i;

async function signInAsSuperAdmin(page: Page, problems: PageProblems): Promise<void> {
  expectCodeRequest(problems);
  await page.goto(APP.admin);
  await page.getByLabel("Work email").fill("ops@betng.test");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const field = page.getByLabel("Authentication code");

  await expect(field).toBeVisible();
  // The code form submits itself once six digits are in.
  await field.fill(await nextAdminCode());

  await expect(page.getByRole("navigation").first()).toBeVisible();
}

const AREAS = [
  "Dashboard", "Users", "Shops", "Cashiers", "Leagues", "Teams", "Fixtures", "Matches", "Markets", "Odds", "Risk",
  "Live Control", "Simulation", "Settlement", "Wallet", "Reports", "Audit Logs", "System Health", "Settings",
];

test.describe("admin", () => {
  test.describe.configure({ timeout: 240_000 });

  test("requires the second factor where the account has one", async ({ page, problems }) => {
    expectCodeRequest(problems);
    await page.goto(APP.admin);
    await page.getByLabel("Work email").fill("ops@betng.test");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByLabel("Authentication code")).toBeVisible();
    await expect(page.getByRole("navigation", { name: /main|admin|sections/i })).toHaveCount(0);
  });

  test("opens every area of the control plane, and none offers a control that decides a result", async ({ page, problems }) => {
    await signInAsSuperAdmin(page, problems);

    for (const area of AREAS) {
      await page.getByRole("link", { name: area, exact: true }).first().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText(/something went wrong/i);

      const controls = await page.getByRole("main").locator("button, a, [role=menuitem], option").allInnerTexts();

      expect(controls.filter((label) => FORBIDDEN.test(label)), `forbidden controls on ${area}`).toEqual([]);
    }
  });

  test("keeps the console locked for an operator without a second factor", async ({ page }) => {
    await page.goto(APP.admin);
    await page.getByLabel("Work email").fill("support@betng.test");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("alertdialog", { name: "Two-step verification required" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
  });

  test.fixme("hides areas a support role may not read and refuses them on a direct address", async ({ page }) => {
    // The seeded support operator has no second factor and the platform has no operator enrolment route, so its console stays locked.
    await page.goto(APP.admin);

    await expect(page.getByRole("link", { name: "Risk", exact: true })).toHaveCount(0);
    await page.goto(`${APP.admin}/risk`);
    await expect(page.getByRole("main")).toContainText(/permission|not allowed|access/i);
  });

  test("puts a destructive action behind a confirmation that needs a reason", async ({ page, problems }) => {
    await signInAsSuperAdmin(page, problems);
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
    test(`has no serious accessibility violations on the dashboard in the ${theme} theme`, async ({ page, problems }) => {
      await signInAsSuperAdmin(page, problems);
      await setTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page);
    });
  }
});
