import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Secret } from "../src/configs/index.js";
import { WEBHOOK_PAYLOAD_CONTEXT } from "../src/constants/payments.constant.js";
import { createFieldCipher } from "../src/security/crypto.js";
import { rekeyWallet } from "../src/security/rekey.js";
import { RECONCILE_REASON, reconciliationVerdict } from "../src/services/payments/reconciliation.js";
import type { ClosedPayment } from "../src/services/payments/reconciliation.js";
import { openRepository } from "./support.js";
import type { DirectRepository } from "./support.js";

let direct: DirectRepository;

beforeAll(async () => {
  direct = await openRepository();
});

afterAll(async () => {
  await direct.close();
});

function key(): Secret {
  return new Secret(randomBytes(32).toString("base64"));
}

describe("key rotation", () => {
  const oldKey = key();
  const newKey = key();
  const before = createFieldCipher({ version: 1, secret: oldKey });
  const after = createFieldCipher({ version: 2, secret: newKey }, [{ version: 1, secret: oldKey }]);

  async function bankAccount(userId: string, accountNumber: string, ciphertext = before.encrypt(accountNumber, userId)) {
    return direct.prisma.bankAccount.create({
      data: {
        id: randomUUID(),
        userId,
        provider: "PAYSTACK",
        bankCode: "058",
        bankName: "Guaranty Trust Bank",
        accountNumberEncrypted: ciphertext,
        accountNumberHash: before.lookupHash(`058:${accountNumber}`),
        last4: accountNumber.slice(-4),
        accountName: "ADA OBI",
        verifiedAt: new Date(),
      },
    });
  }

  it("moves every column onto the active key and re-hashes lookups in the same write", async () => {
    const userId = randomUUID();
    const account = await bankAccount(userId, "0123456789");
    const verification = await direct.prisma.bankAccountVerification.create({
      data: {
        id: randomUUID(),
        userId,
        provider: "PAYSTACK",
        bankCode: "058",
        bankName: "Guaranty Trust Bank",
        accountNumberEncrypted: before.encrypt("0123456789", userId),
        accountNumberHash: before.lookupHash("058:0123456789"),
        last4: "6789",
        accountName: "ADA OBI",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const webhook = await direct.prisma.paymentWebhookEvent.create({
      data: {
        id: randomUUID(),
        provider: "PAYSTACK",
        eventId: randomUUID(),
        eventType: "charge.success",
        payloadEncrypted: before.encrypt('{"body":"e30="}', WEBHOOK_PAYLOAD_CONTEXT),
      },
    });

    const report = await rekeyWallet(direct.prisma, after, { maxRows: 1_000_000 });

    expect(report.rewritten).toBeGreaterThanOrEqual(3);

    const moved = await direct.prisma.bankAccount.findUniqueOrThrow({ where: { id: account.id } });
    const movedVerification = await direct.prisma.bankAccountVerification.findUniqueOrThrow({ where: { id: verification.id } });
    const movedWebhook = await direct.prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: webhook.id } });

    expect(moved.accountNumberEncrypted?.startsWith("v2:")).toBe(true);
    expect(after.decrypt(moved.accountNumberEncrypted ?? "", userId)).toBe("0123456789");
    expect(moved.accountNumberHash).toBe(after.lookupHash("058:0123456789"));
    expect(moved.accountNumberHash).not.toBe(account.accountNumberHash);
    expect(movedVerification.accountNumberEncrypted.startsWith("v2:")).toBe(true);
    expect(movedVerification.accountNumberHash).toBe(moved.accountNumberHash);
    expect(after.decrypt(movedWebhook.payloadEncrypted ?? "", WEBHOOK_PAYLOAD_CONTEXT)).toBe('{"body":"e30="}');

    // The retired key can now go: the new ring alone opens the rows.
    const withoutRetired = createFieldCipher({ version: 2, secret: newKey });

    expect(withoutRetired.decrypt(moved.accountNumberEncrypted ?? "", userId)).toBe("0123456789");
  });

  it("reports a row no configured key opens and leaves it untouched", async () => {
    const userId = randomUUID();
    const stranger = createFieldCipher({ version: 7, secret: key() });
    const ciphertext = stranger.encrypt("0987654321", userId);
    const account = await bankAccount(userId, "0987654321", ciphertext);

    const report = await rekeyWallet(direct.prisma, after, { maxRows: 1_000_000 });

    expect(report.failed).toContain(`bank_accounts:${account.id}`);
    expect(report.remaining).toBeGreaterThanOrEqual(1);
    expect((await direct.prisma.bankAccount.findUniqueOrThrow({ where: { id: account.id } })).accountNumberEncrypted).toBe(ciphertext);
  });

  it("skips a deleted account, whose number was already cleared", async () => {
    const account = await bankAccount(randomUUID(), "0112233445");

    await direct.prisma.bankAccount.update({ where: { id: account.id }, data: { accountNumberEncrypted: null, deletedAt: new Date() } });

    const report = await rekeyWallet(direct.prisma, after, { maxRows: 1_000_000 });

    expect(report.failed).not.toContain(`bank_accounts:${account.id}`);
    expect((await direct.prisma.bankAccount.findUniqueOrThrow({ where: { id: account.id } })).accountNumberEncrypted).toBeNull();
  });
});

describe("reconciliation verdict", () => {
  const deposit = (status: string): ClosedPayment => ({ direction: "DEPOSIT", status, amount: 500_000n, netAmount: 500_000n, currency: "NGN" });
  const withdrawal = (status: string): ClosedPayment => ({
    direction: "WITHDRAWAL",
    status,
    amount: 1_000_000n,
    netAmount: 997_500n,
    currency: "NGN",
  });
  const paid = (amount: number) => ({ kind: "SUCCEEDED" as const, amount, currency: "NGN" });

  it.each([
    ["a credited deposit the provider confirms", deposit("CONFIRMED"), paid(500_000), { kind: "AGREES" }],
    ["an expired deposit the provider never charged", deposit("EXPIRED"), { kind: "FAILED" as const }, { kind: "AGREES" }],
    ["a deposit paid after it expired", deposit("EXPIRED"), paid(500_000), { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_PAID_LATE }],
    ["a credit the provider has no record of", deposit("CONFIRMED"), { kind: "NOT_FOUND" as const }, { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_NOT_PAID }],
    ["a credit for a different amount", deposit("CONFIRMED"), paid(400_000), { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_AMOUNT }],
    ["a charge reversed after credit", deposit("CONFIRMED"), { kind: "REVERSED" as const }, { kind: "FLAG", reason: RECONCILE_REASON.DEPOSIT_REVERSED }],
    ["a withdrawal the provider paid", withdrawal("CONFIRMED"), paid(997_500), { kind: "AGREES" }],
    ["a refunded withdrawal the bank paid anyway", withdrawal("FAILED"), paid(997_500), { kind: "FLAG", reason: RECONCILE_REASON.TRANSFER_PAID_AFTER_REFUND }],
    ["a confirmed withdrawal the provider never sent", withdrawal("CONFIRMED"), { kind: "FAILED" as const }, { kind: "FLAG", reason: RECONCILE_REASON.TRANSFER_NOT_PAID }],
    ["a paid withdrawal the bank returned", withdrawal("CONFIRMED"), { kind: "REVERSED" as const }, { kind: "SETTLE" }],
    ["a provider still processing", withdrawal("CONFIRMED"), { kind: "PROCESSING" as const }, { kind: "WAIT" }],
  ])("%s", (_label, payment, outcome, verdict) => {
    expect(reconciliationVerdict(payment, outcome)).toEqual(verdict);
  });

  it("stops waiting once the provider has had long enough", () => {
    expect(reconciliationVerdict(deposit("EXPIRED"), { kind: "PENDING" }, true)).toEqual({ kind: "AGREES" });
    expect(reconciliationVerdict(withdrawal("FAILED"), { kind: "PROCESSING" }, true)).toEqual({
      kind: "FLAG",
      reason: RECONCILE_REASON.TRANSFER_STILL_OPEN,
    });
  });
});
