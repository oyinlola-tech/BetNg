// @ts-check
// ESLint and typescript-eslint come from tools/lint, the one package that resolves `typescript` to the TS 6 API typescript-eslint needs. Everything else compiles with TypeScript 7.
import { js, reactHooks, tseslint } from "./tools/lint/index.js";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.venv/**",
      "**/generated/**",
      "**/.expo/**",
      ".kilo/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Test files sit outside each package's build tsconfig.
          allowDefaultProject: ["packages/*/tests/*.ts", "apps/*/tests/*.ts", "apps/services/*/tests/*.ts", "apps/services/*/prisma.config.ts", "vitest.config.ts", "playwright.config.ts"],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Storage and parsing fallbacks swallow by design; the fallback value follows the block.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["apps/{web,tv,shop,admin,mobile}/src/**/*.{ts,tsx}", "packages/ui-web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Test doubles are async to match the interfaces they stand in for, and are passed around unbound.
    files: ["**/tests/**/*.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    // Plain-JS tooling scripts are not part of a TypeScript program.
    files: ["**/*.mjs", "**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    // Node and browser globals are not declared for untyped scripts.
    rules: { "no-undef": "off" },
  },
);
