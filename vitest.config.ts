import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "apps/gateway/tests/**/*.test.ts",
      "apps/services/*/tests/**/*.test.ts",
    ],
    environment: "node",
    fileParallelism: false,
  },
});
