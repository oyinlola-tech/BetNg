import type { TwoFactorStatus } from "@betng/contracts";
import { ACCOUNT_SECURITY, AUDIT_ENTITY } from "../../constants/index.js";
import { InvalidInputError } from "../../errors/index.js";
import type { Customer, CustomerTwoFactor } from "../../generated/prisma/client.js";
import type { AuditEntryInput, HandlerDependencies, IdentityStore } from "../../interfaces/index.js";

export function customerAuditActor(
  customer: Customer,
  requestId: string,
): Pick<AuditEntryInput, "actorId" | "actorRole" | "actorName" | "entityType" | "entityId" | "requestId"> {
  return {
    actorId: customer.id,
    actorRole: "CUSTOMER",
    actorName: customer.displayName,
    entityType: AUDIT_ENTITY.CUSTOMER,
    entityId: customer.id,
    requestId,
  };
}

export function toTwoFactorStatus(factor: CustomerTwoFactor | undefined, backupCodesRemaining: number): TwoFactorStatus {
  return factor === undefined
    ? { enabled: false, required: false }
    : { enabled: true, method: "TOTP", enabledAt: factor.enabledAt.toISOString(), backupCodesRemaining, required: false };
}

/** Refuses the current and recent passwords, and (when switched on) one found in the breach corpus. */
export async function assertAcceptablePassword(
  deps: Pick<HandlerDependencies, "hasher" | "breachChecker">,
  store: IdentityStore,
  customer: Customer,
  candidate: string,
): Promise<void> {
  const recent = await store.passwords.recentHashes(customer.id, ACCOUNT_SECURITY.PASSWORD_HISTORY_DEPTH - 1);

  for (const hash of [customer.passwordHash, ...recent]) {
    if (await deps.hasher.verify(candidate, hash)) {
      throw new InvalidInputError("newPassword", "Choose a password you have not used recently.");
    }
  }

  if (await deps.breachChecker.isBreached(candidate)) {
    throw new InvalidInputError("newPassword", "This password has appeared in a data breach. Choose a different one.");
  }
}

/** Thrown inside a transaction to roll back a spent code when the rest of the step fails. */
export class RejectedCode extends Error {
  public constructor() {
    super("The second-factor code was not accepted.");
    this.name = "RejectedCode";
  }
}

export const codeRejected = (field = "code"): InvalidInputError =>
  new InvalidInputError(field, "That code is not right. Check your authenticator or use a backup code.");

/** Read from the wallet and betting schemas at the moment of asking; the deletion job re-checks them before it runs. */
export async function deletionBlockers(readModel: HandlerDependencies["readModel"], customerId: string): Promise<readonly string[]> {
  const figures = await readModel.deletionBlockers(customerId);
  const blockers: string[] = [];

  if (figures.balance > 0n) blockers.push("Withdraw your remaining balance first.");
  if (figures.openPayments > 0) blockers.push("A payment is still processing.");
  if (figures.openBets > 0) blockers.push("You have bets that have not settled yet.");

  return blockers;
}
