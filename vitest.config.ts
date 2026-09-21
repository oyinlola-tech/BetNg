import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/*/tests/**/*.test.ts",
            "apps/gateway/tests/**/*.test.ts",
            "apps/services/*/tests/**/*.test.ts",
          ],
          environment: "node",
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "dom",
          include: [
            "packages/ui-web/tests/**/*.test.tsx",
            "apps/{web,shop,admin,tv}/tests/**/*.test.{ts,tsx}",
          ],
          environment: "jsdom",
          setupFiles: ["packages/ui-web/tests/support/setup.ts"],
        },
      },
    ],
  },
});
