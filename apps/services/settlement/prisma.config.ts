import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads `.env` itself; variables already set (CI, a container) win.
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

// Only `migrate dev` uses the shadow database; a dedicated one spares the service role CREATEDB.
const shadowDatabaseUrl = process.env[SHADOW_DATABASE_URL];

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url,
    ...(shadowDatabaseUrl === undefined || shadowDatabaseUrl === ""
      ? {}
      : { shadowDatabaseUrl }),
  },
});
