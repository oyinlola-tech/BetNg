// Creates the platform's first super administrator, once. Operator tool: needs database access and
// SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD. The identity service runs the same step at startup, so this is
// for creating the account ahead of a deploy.
//
// Usage: pnpm --filter @betng/identity-service run bootstrap:super-admin

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseSchema } from "@betng/service-kit";
import { PrismaClient } from "../generated/prisma/client.js";
import { createIdentityStore } from "../repositories/index.js";
import { createPasswordHasher } from "../services/security/index.js";
import { bootstrapSuperAdmin, BootstrapRefusedError } from "./bootstrapSuperAdmin.js";

const envFile = resolve(import.meta.dirname, "../../../../../.env");

if (process.env["IDENTITY_DATABASE_URL"] === undefined && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const url = process.env["IDENTITY_DATABASE_URL"];

if (url === undefined || url === "") {
  fail("IDENTITY_DATABASE_URL must be set.");
}

// No IDENTITY_DATA_KEY is needed: nothing here is encrypted, because no authenticator secret is issued.
const production = process.env["NODE_ENV"] === "production";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: databaseSchema(url) }) });

try {
  const outcome = await bootstrapSuperAdmin({
    store: createIdentityStore(prisma),
    hasher: createPasswordHasher(),
    production,
    env: process.env,
  });

  if (outcome.kind === "exists") {
    process.stdout.write("A super administrator already exists; nothing was changed.\n");
  } else if (outcome.kind === "skipped") {
    process.stdout.write(`${outcome.reason} Skipped: no super administrator was created.\n`);
  } else {
    // Nothing secret is printed: the password came from the environment, and the authenticator is issued
    // to whoever activates, over their own connection.
    process.stdout.write(
      `Created the super administrator ${outcome.email}.\n` +
        `Activate before ${outcome.expiresAt.toISOString()}:\n` +
        "  POST /api/v1/admin/auth/activate/start  with the address and SUPER_ADMIN_PASSWORD → an authenticator to enrol\n" +
        "  POST /api/v1/admin/auth/activate        with a chosen password and a code → signed in\n" +
        "Then clear SUPER_ADMIN_PASSWORD from the environment.\n",
    );
  }
} catch (error) {
  if (error instanceof BootstrapRefusedError) {
    fail(error.message);
  }

  throw error;
} finally {
  await prisma.$disconnect();
}
