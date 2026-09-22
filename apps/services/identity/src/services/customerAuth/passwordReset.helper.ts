import { randomUUID } from "node:crypto";
import { ACCOUNT_SECURITY } from "../../constants/index.js";
import type { Customer } from "../../generated/prisma/client.js";
import type { IdentityStore } from "../../interfaces/index.js";
import { sixDigitCode, verificationCodeHash } from "../../utils/index.js";

export interface IssuedReset {
  readonly code: string;
  readonly expiresAt: Date;
}

export function canReceiveReset(customer: Customer): boolean {
  return customer.status === "ACTIVE" && customer.emailVerifiedAt !== null && customer.deletedAt === null;
}

/** Replaces any outstanding code. Undefined when one was issued within the resend interval (per account, whoever asked). */
export async function issuePasswordReset(store: IdentityStore, customer: Customer): Promise<IssuedReset | undefined> {
  const latest = await store.passwords.findLatestReset(customer.id);

  if (latest !== undefined && Date.now() - latest.createdAt.getTime() < ACCOUNT_SECURITY.PASSWORD_RESET_INTERVAL_MS) {
    return undefined;
  }

  const id = randomUUID();
  const code = sixDigitCode();
  const expiresAt = new Date(Date.now() + ACCOUNT_SECURITY.PASSWORD_RESET_TTL_MS);

  await store.transaction(async (repositories) =>
    repositories.passwords.replaceReset(customer.id, id, verificationCodeHash(id, code), expiresAt),
  );

  return { code, expiresAt };
}
