// Enrols (or re-enrols) an admin in TOTP. Operator tool: needs database access and IDENTITY_DATA_KEY (the secret is stored
// encrypted with it), prints the secret once.
// Usage: pnpm --filter @betng/identity-service exec tsx src/seeds/enrolAdminTotp.cli.ts <admin email>

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseSchema } from "@betng/service-kit";
import { DEVELOPMENT_DATA_KEY } from "../configs/index.js";
import { ACCOUNT_SECURITY, AUDIT_ACTION, AUDIT_ENTITY, SYSTEM_ACTOR } from "../constants/index.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { adminTotpContext } from "../services/adminAuth/index.js";
import { createDataProtector, encodeBase32, normaliseEmail, TOTP_DIGITS, TOTP_STEP_SECONDS } from "../utils/index.js";

const envFile = resolve(import.meta.dirname, "../../../../../.env");

if (process.env["IDENTITY_DATABASE_URL"] === undefined && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const url = process.env["IDENTITY_DATABASE_URL"];
const email = process.argv[2];

if (url === undefined || email === undefined) {
  process.stderr.write("Usage: enrolAdminTotp.cli.ts <admin email>  (IDENTITY_DATABASE_URL must be set)\n");
  process.exit(2);
}

const rawKey = process.env["IDENTITY_DATA_KEY"];
const production = process.env["NODE_ENV"] === "production";

if ((rawKey === undefined || rawKey === "") && production) {
  process.stderr.write("IDENTITY_DATA_KEY must be set in production.\n");
  process.exit(2);
}

const dataKey = rawKey === undefined || rawKey === "" ? DEVELOPMENT_DATA_KEY : Buffer.from(rawKey, "base64");

if (dataKey.length !== 32 || (production && dataKey.equals(DEVELOPMENT_DATA_KEY))) {
  process.stderr.write("IDENTITY_DATA_KEY must be a 32-byte base64 key (not the development key in production).\n");
  process.exit(2);
}

const protector = createDataProtector(dataKey);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: databaseSchema(url) }) });

try {
  const admin = await prisma.adminUser.findUnique({ where: { email: normaliseEmail(email) } });

  if (admin === null) {
    process.stderr.write("No admin has that email.\n");
    process.exitCode = 1;
  } else {
    const secret = encodeBase32(randomBytes(ACCOUNT_SECURITY.TOTP_SECRET_BYTES));

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: admin.id }, data: { totpSecret: protector.encrypt(secret, adminTotpContext(admin.id)), twoFactorEnabled: true, totpLastStep: null } });
      await tx.session.updateMany({ where: { kind: "ADMIN", subjectId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: SYSTEM_ACTOR.id,
          actorRole: SYSTEM_ACTOR.role,
          actorName: "Admin TOTP enrolment CLI",
          action: AUDIT_ACTION.ADMIN_TOTP_ENROLLED,
          entityType: AUDIT_ENTITY.ADMIN_USER,
          entityId: admin.id,
          severity: "NOTICE",
          requestId: "cli",
        },
      });
    });

    const label = encodeURIComponent(`${ACCOUNT_SECURITY.TOTP_ISSUER} Admin:${admin.email}`);
    const query = new URLSearchParams({
      secret,
      issuer: `${ACCOUNT_SECURITY.TOTP_ISSUER} Admin`,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_STEP_SECONDS),
    });

    process.stdout.write(
      `Enrolled ${admin.email}. Add this to the admin's authenticator now; it is not shown again.\n` +
        `otpauth://totp/${label}?${query.toString()}\n` +
        `Manual key: ${(secret.match(/.{1,4}/gu) ?? []).join(" ")}\n` +
        "Existing admin sessions for this account were signed out.\n",
    );
  }
} finally {
  await prisma.$disconnect();
}
