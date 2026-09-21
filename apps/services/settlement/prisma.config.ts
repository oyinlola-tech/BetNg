/**
 * Prisma 7 reads the `migrate`/`db` connection URL from here rather than
 * from `schema.prisma`; the runtime client uses a driver adapter.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { defineConfig } from "prisma/config";

/**
 * Loads the repository-root `.env` if the variables are not already set.
 *
 * Prisma 7 no longer reads `.env` on its own, and a developer running
 * `pnpm db:migrate` should not have to export four URLs by hand. An
 * environment that already supplies them — CI, a container — wins, because
 * `loadEnvFile` does not overwrite what is set.
 */
function loadRootEnv(): void {
  const envFile = resolve(import.meta.dirname, "../../../.env");

  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

loadRootEnv();

const DATABASE_URL = "SETTLEMENT_DATABASE_URL";
const SHADOW_DATABASE_URL = "SETTLEMENT_SHADOW_DATABASE_URL";

const url = process.env[DATABASE_URL];

if (url === undefined || url === "") {
  throw new Error(
    `${DATABASE_URL} is not set. Copy .env.example to .env, or export it.`,
  );
}

/**
 * The shadow database `migrate dev` diffs against.
 *
 * Optional: only `migrate dev` uses it. `migrate deploy` and `generate` —
 * which are what run outside a developer's machine — do not, and must not
 * fail because a development-only variable is absent.
 */
const shadowDatabaseUrl = process.env[SHADOW_DATABASE_URL];

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url,
    // Pointing `migrate dev` at a dedicated shadow database means this
    // service's role does not need CREATEDB — a privilege that would let it
    // create a database outside its own boundary.
    ...(shadowDatabaseUrl === undefined || shadowDatabaseUrl === ""
      ? {}
      : { shadowDatabaseUrl }),
  },
});
