// Prints the current TOTP code of a seeded two-factor admin, read from the development database. Refused in production.
// Usage: pnpm --filter @betng/identity-service totp:dev [admin email]

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseSchema } from "@betng/service-kit";
import { DEVELOPMENT_DATA_KEY } from "../configs/index.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { adminTotpContext } from "../services/adminAuth/index.js";
import { createDataProtector, generateTotp, normaliseEmail } from "../utils/index.js";

const envFile = resolve(import.meta.dirname, "../../../../../.env");

if (process.env["IDENTITY_DATABASE_URL"] === undefined && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const mode = process.env["NODE_ENV"] ?? "development";

if (mode !== "development" && mode !== "test") {
  process.stderr.write("The seed TOTP helper runs only with NODE_ENV=development or test.\n");
  process.exit(2);
}

const url = process.env["IDENTITY_DATABASE_URL"];

if (url === undefined) {
  process.stderr.write("IDENTITY_DATABASE_URL must be set.\n");
  process.exit(2);
}

const rawKey = process.env["IDENTITY_DATA_KEY"];
const dataKey = rawKey === undefined || rawKey === "" ? DEVELOPMENT_DATA_KEY : Buffer.from(rawKey, "base64");
const protector = createDataProtector(dataKey);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: databaseSchema(url) }) });

try {
  const admin = await prisma.adminUser.findUnique({ where: { email: normaliseEmail(process.argv[2] ?? "ops@betng.test") } });

  if (admin?.totpSecret === null || admin?.totpSecret === undefined) {
    process.stderr.write("That admin does not exist or has no two-factor secret.\n");
    process.exitCode = 1;
  } else {
    const secret = admin.totpSecret.startsWith("v1.") ? protector.decrypt(admin.totpSecret, adminTotpContext(admin.id)) : admin.totpSecret;

    process.stdout.write(`${generateTotp(secret, Date.now())}\n`);
  }
} finally {
  await prisma.$disconnect();
}
