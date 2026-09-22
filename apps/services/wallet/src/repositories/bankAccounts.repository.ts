import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { TRANSACTION_OPTIONS } from "./wallet.repository.js";

export type BankAccountRow = Prisma.BankAccountGetPayload<Record<string, never>>;

export type VerificationRow = Prisma.BankAccountVerificationGetPayload<Record<string, never>>;

export interface NewVerification {
  readonly userId: string;
  readonly provider: string;
  readonly bankCode: string;
  readonly bankName: string;
  readonly accountNumberEncrypted: string;
  readonly accountNumberHash: string;
  readonly last4: string;
  readonly accountName: string;
  readonly expiresAt: Date;
}

export type SaveOutcome =
  | { readonly kind: "SAVED"; readonly account: BankAccountRow }
  | { readonly kind: "MISSING" }
  | { readonly kind: "DUPLICATE" };

export interface BankAccountsRepository {
  createVerification(input: NewVerification): Promise<VerificationRow>;
  recentVerifications(userId: string, since: Date): Promise<number>;
  saveFromVerification(userId: string, verificationId: string, makeDefault: boolean, now: Date): Promise<SaveOutcome>;
  list(userId: string): Promise<readonly BankAccountRow[]>;
  findOwned(userId: string, id: string): Promise<BankAccountRow | undefined>;
  findById(id: string): Promise<BankAccountRow | undefined>;
  makeDefault(userId: string, id: string): Promise<BankAccountRow | undefined>;
  remove(userId: string, id: string): Promise<boolean>;
  setRecipientCode(id: string, recipientCode: string): Promise<void>;
}

export function createBankAccountsRepository(prisma: PrismaClient): BankAccountsRepository {
  async function clearDefault(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.bankAccount.updateMany({ where: { userId, isDefault: true, deletedAt: null }, data: { isDefault: false } });
  }

  return {
    createVerification: async (input) => prisma.bankAccountVerification.create({ data: { id: randomUUID(), ...input } }),

    recentVerifications: async (userId, since) =>
      prisma.bankAccountVerification.count({ where: { userId, createdAt: { gte: since } } }),

    saveFromVerification: async (userId, verificationId, makeDefault, now) =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "wallet"."bank_account_verifications"
          WHERE "id" = ${verificationId}::uuid AND "user_id" = ${userId}::uuid
            AND "consumed_at" IS NULL AND "expires_at" > ${now}::timestamptz
          FOR UPDATE`;

        if (rows.length === 0) {
          return { kind: "MISSING" } as const;
        }

        const verification = await tx.bankAccountVerification.update({
          where: { id: verificationId },
          data: { consumedAt: now },
        });

        const duplicate = await tx.bankAccount.findFirst({
          where: {
            userId,
            accountNumberHash: verification.accountNumberHash,
            bankCode: verification.bankCode,
            deletedAt: null,
          },
        });

        if (duplicate !== null) {
          return { kind: "DUPLICATE" } as const;
        }

        const others = await tx.bankAccount.count({ where: { userId, deletedAt: null } });
        const isDefault = makeDefault || others === 0;

        if (isDefault) {
          await clearDefault(tx, userId);
        }

        const account = await tx.bankAccount.create({
          data: {
            id: randomUUID(),
            userId,
            provider: verification.provider,
            bankCode: verification.bankCode,
            bankName: verification.bankName,
            accountNumberEncrypted: verification.accountNumberEncrypted,
            accountNumberHash: verification.accountNumberHash,
            last4: verification.last4,
            accountName: verification.accountName,
            isDefault,
            verifiedAt: verification.createdAt,
          },
        });

        return { kind: "SAVED", account } as const;
      }, TRANSACTION_OPTIONS),

    list: async (userId) =>
      prisma.bankAccount.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),

    findOwned: async (userId, id) => (await prisma.bankAccount.findFirst({ where: { id, userId, deletedAt: null } })) ?? undefined,

    findById: async (id) => (await prisma.bankAccount.findUnique({ where: { id } })) ?? undefined,

    makeDefault: async (userId, id) =>
      prisma.$transaction(async (tx) => {
        const account = await tx.bankAccount.findFirst({ where: { id, userId, deletedAt: null } });

        if (account === null) {
          return undefined;
        }

        await clearDefault(tx, userId);

        return tx.bankAccount.update({ where: { id }, data: { isDefault: true, updatedAt: new Date() } });
      }, TRANSACTION_OPTIONS),

    /** The in-flight check and the delete share the row lock a new withdrawal also takes on its bank account. */
    remove: async (userId, id) =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "wallet"."bank_accounts"
          WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid AND "deleted_at" IS NULL
          FOR UPDATE`;

        if (rows.length === 0) {
          return false;
        }

        const inFlight = await tx.payment.count({
          where: { bankAccountId: id, direction: "WITHDRAWAL", status: { in: ["INITIATED", "PENDING", "PROCESSING"] } },
        });

        if (inFlight > 0) {
          throw Object.assign(new Error("in flight"), { inFlight: true });
        }

        await tx.bankAccount.update({
          where: { id },
          data: { deletedAt: new Date(), isDefault: false, accountNumberEncrypted: null, recipientCode: null, updatedAt: new Date() },
        });

        return true;
      }, TRANSACTION_OPTIONS),

    setRecipientCode: async (id, recipientCode) => {
      await prisma.bankAccount.update({ where: { id }, data: { recipientCode: recipientCode.slice(0, 120), updatedAt: new Date() } });
    },
  };
}
