import type { PrismaClient } from "../generated/prisma/client.js";
import { WEBHOOK_PAYLOAD_CONTEXT } from "../constants/payments.constant.js";
import type { FieldCipher } from "./crypto.js";

export interface RekeyReport {
  readonly rewritten: number;
  /** `table:id` of rows that open under no key in the ring: a dropped key or a tampered ciphertext. */
  readonly failed: readonly string[];
  /** Rows still not on the active key after this run. */
  readonly remaining: number;
}

export interface RekeyOptions {
  readonly batchSize?: number;
  /** Caps the rows rewritten per run so one pass never holds the job loop for long. */
  readonly maxRows?: number;
}

interface Candidate {
  readonly id: string;
  readonly ciphertext: string;
  readonly context: string;
  readonly bankCode?: string;
}

interface EncryptedColumn {
  readonly table: string;
  page(prefix: string, after: string, take: number): Promise<readonly Candidate[]>;
  count(prefix: string): Promise<number>;
  /** Compare-and-set on the old ciphertext, so a row changed or cleared meanwhile is left alone. */
  write(candidate: Candidate, ciphertext: string, lookupHash: string | undefined): Promise<boolean>;
}

const FIRST_ID = "00000000-0000-0000-0000-000000000000";

function columns(prisma: PrismaClient): readonly EncryptedColumn[] {
  const bankWhere = (prefix: string) => ({
    AND: [{ accountNumberEncrypted: { not: null } }, { NOT: { accountNumberEncrypted: { startsWith: prefix } } }],
  });
  const webhookWhere = (prefix: string) => ({
    AND: [{ payloadEncrypted: { not: null } }, { NOT: { payloadEncrypted: { startsWith: prefix } } }],
  });

  return [
    {
      table: "bank_accounts",
      page: async (prefix, after, take) =>
        (
          await prisma.bankAccount.findMany({
            where: { ...bankWhere(prefix), id: { gt: after } },
            select: { id: true, userId: true, bankCode: true, accountNumberEncrypted: true },
            orderBy: { id: "asc" },
            take,
          })
        ).map((row) => ({ id: row.id, ciphertext: row.accountNumberEncrypted ?? "", context: row.userId, bankCode: row.bankCode })),
      count: async (prefix) => prisma.bankAccount.count({ where: bankWhere(prefix) }),
      write: async (candidate, ciphertext, lookupHash) =>
        (
          await prisma.bankAccount.updateMany({
            where: { id: candidate.id, accountNumberEncrypted: candidate.ciphertext },
            data: { accountNumberEncrypted: ciphertext, ...(lookupHash === undefined ? {} : { accountNumberHash: lookupHash }), updatedAt: new Date() },
          })
        ).count === 1,
    },
    {
      table: "bank_account_verifications",
      page: async (prefix, after, take) =>
        (
          await prisma.bankAccountVerification.findMany({
            where: { NOT: { accountNumberEncrypted: { startsWith: prefix } }, id: { gt: after } },
            select: { id: true, userId: true, bankCode: true, accountNumberEncrypted: true },
            orderBy: { id: "asc" },
            take,
          })
        ).map((row) => ({ id: row.id, ciphertext: row.accountNumberEncrypted, context: row.userId, bankCode: row.bankCode })),
      count: async (prefix) => prisma.bankAccountVerification.count({ where: { NOT: { accountNumberEncrypted: { startsWith: prefix } } } }),
      write: async (candidate, ciphertext, lookupHash) =>
        (
          await prisma.bankAccountVerification.updateMany({
            where: { id: candidate.id, accountNumberEncrypted: candidate.ciphertext },
            data: { accountNumberEncrypted: ciphertext, ...(lookupHash === undefined ? {} : { accountNumberHash: lookupHash }) },
          })
        ).count === 1,
    },
    {
      table: "payment_webhook_events",
      page: async (prefix, after, take) =>
        (
          await prisma.paymentWebhookEvent.findMany({
            where: { ...webhookWhere(prefix), id: { gt: after } },
            select: { id: true, payloadEncrypted: true },
            orderBy: { id: "asc" },
            take,
          })
        ).map((row) => ({ id: row.id, ciphertext: row.payloadEncrypted ?? "", context: WEBHOOK_PAYLOAD_CONTEXT })),
      count: async (prefix) => prisma.paymentWebhookEvent.count({ where: webhookWhere(prefix) }),
      write: async (candidate, ciphertext) =>
        (
          await prisma.paymentWebhookEvent.updateMany({
            where: { id: candidate.id, payloadEncrypted: candidate.ciphertext },
            data: { payloadEncrypted: ciphertext },
          })
        ).count === 1,
    },
  ];
}

/**
 * Moves every encrypted wallet column onto the active key, re-hashing bank-account
 * lookups in the same write because the lookup hash follows the active key.
 * Once `remaining` is 0 the retired keys can be dropped from config.
 */
export async function rekeyWallet(prisma: PrismaClient, cipher: FieldCipher, options: RekeyOptions = {}): Promise<RekeyReport> {
  const batchSize = options.batchSize ?? 200;
  const maxRows = options.maxRows ?? 1_000;
  const prefix = `v${String(cipher.activeVersion)}:`;
  const failed: string[] = [];
  let rewritten = 0;

  for (const column of columns(prisma)) {
    let after = FIRST_ID;

    while (rewritten < maxRows) {
      const batch = await column.page(prefix, after, batchSize);

      for (const candidate of batch) {
        after = candidate.id;

        let plaintext: string;

        try {
          plaintext = cipher.decrypt(candidate.ciphertext, candidate.context);
        } catch {
          failed.push(`${column.table}:${candidate.id}`);
          continue;
        }

        const lookupHash = candidate.bankCode === undefined ? undefined : cipher.lookupHash(`${candidate.bankCode}:${plaintext}`);

        if (await column.write(candidate, cipher.encrypt(plaintext, candidate.context), lookupHash)) {
          rewritten += 1;
        }
      }

      if (batch.length < batchSize) {
        break;
      }
    }
  }

  let remaining = 0;

  for (const column of columns(prisma)) {
    remaining += await column.count(prefix);
  }

  return { rewritten, failed, remaining };
}
