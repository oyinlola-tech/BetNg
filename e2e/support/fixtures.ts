import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

export const APP = {
  web: "http://127.0.0.1:4200",
  tv: "http://127.0.0.1:4300",
  shop: "http://127.0.0.1:4400",
  admin: "http://127.0.0.1:4500",
} as const;

export interface PageProblems {
  readonly console: string[];
  readonly requests: string[];
}

const IGNORED_CONSOLE = [/Download the React DevTools/, /\[vite\]/, /\[performance\]/];

function watch(page: Page): PageProblems {
  const problems: PageProblems = { console: [], requests: [] };

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;

    const text = message.text();

    if (!IGNORED_CONSOLE.some((pattern) => pattern.test(text))) problems.console.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.console.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";

    if (!/ERR_ABORTED|ERR_NETWORK_CHANGED/.test(failure)) problems.requests.push(`${request.method()} ${request.url()} ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.requests.push(`${String(response.status())} ${response.url()}`);
  });

  return problems;
}

/** Every test fails if the page logged an error or warning, threw, or made a failing request. */
export const test = base.extend<{ problems: PageProblems }>({
  problems: [
    async ({ page }, use) => {
      const problems = watch(page);

      await use(problems);

      expect(problems.requests, "failed requests").toEqual([]);
      expect(problems.console, "console errors and warnings").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Serious and critical accessibility violations on the current page. */
export async function expectAccessible(page: Page, options: { readonly exclude?: readonly string[] } = {}): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);

  const { violations } = await builder.analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  expect(
    blocking.map((v) => `${v.id}: ${v.help} (${String(v.nodes.length)}) ${v.nodes[0]?.target.join(" ") ?? ""}`),
    "serious or critical accessibility violations",
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}

export async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-theme", value);
  }, theme);
}
