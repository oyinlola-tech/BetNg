import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const SYSTEM_CHROMIUM = "/usr/bin/chromium";
const executablePath =
  process.env["PLAYWRIGHT_CHROMIUM_PATH"] ??
  (existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined);

const APPS = [
  { name: "web", port: 4200 },
  { name: "tv", port: 4300 },
  { name: "shop", port: 4400 },
  { name: "admin", port: 4500 },
] as const;

export const appUrl = (name: (typeof APPS)[number]["name"]): string =>
  `http://127.0.0.1:${String(APPS.find((app) => app.name === name)?.port ?? 0)}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: process.env["CI"] === undefined ? 0 : 1,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--no-sandbox"],
      ...(executablePath === undefined ? {} : { executablePath }),
    },
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /(\.mobile|\.tv)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /\.mobile\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tv",
      testMatch: /\.tv\.spec\.ts$/,
      use: { viewport: { width: 1920, height: 1080 }, colorScheme: "dark" },
    },
  ],
  // The suites run against the development mock, which stands behind the same interfaces as the platform.
  webServer: APPS.map((app) => ({
    command: `pnpm --filter @betng/${app.name} exec vite --port ${String(app.port)} --strictPort`,
    url: `http://127.0.0.1:${String(app.port)}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_APP_ENV: "test", VITE_DATA_SOURCE: "mock" },
  })),
});
