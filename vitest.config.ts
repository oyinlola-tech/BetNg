import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "apps/gateway/tests/**/*.test.ts",
      "apps/services/*/tests/**/*.test.ts",
    ],
    environment: "node",
    // Each suite binds real TCP ports, so suites must not overlap.
    fileParallelism: false,
  },
});
