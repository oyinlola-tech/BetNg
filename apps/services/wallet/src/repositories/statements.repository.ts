import { randomUUID } from "node:crypto";
import type { StatementFormat } from "@betng/contracts";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { LedgerEntryType } from "../interfaces/index.js";

export type StatementJobRow = Prisma.StatementJobGetPayload<Record<string, never>>;

export interface NewStatementJob {
  readonly userId: string;
  readonly format: StatementFormat;
  readonly from: Date;
  readonly to: Date;
  readonly types: readonly string[];
}

export interface StatementLine {
  readonly createdAt: Date;
  readonly type: LedgerEntryType;
  readonly amount: bigint;
  readonly balanceAfter: bigint;
  readonly reference: string | null;
  readonly note: string | null;
}

export interface StatementData {
  readonly openingBalance: bigint;
  readonly lines: readonly StatementLine[];
  readonly truncated: boolean;
}

export interface StatementsRepository {
  create(input: NewStatementJob): Promise<StatementJobRow>;
  findOwned(userId: string, id: string): Promise<StatementJobRow | undefined>;
  /** Takes one QUEUED job no other worker holds; a claim older than the lease is taken over. */
  claim(id: string | undefined, leaseMs: number): Promise<StatementJobRow | undefined>;
  complete(id: string, storageKey: string): Promise<StatementJobRow>;
  fail(id: string, reason: string): Promise<StatementJobRow>;
  release(id: string): Promise<void>;
  holderName(userId: string): Promise<string>;
  ledger(userId: string, from: Date, toExclusive: Date, types: readonly string[], limit: number): Promise<StatementData>;
}

export function createStatementsRepository(prisma: PrismaClient): StatementsRepository {
  return {
    create: async (input) =>
      prisma.statementJob.create({
        data: {
          id: randomUUID(),
          userId: input.userId,
          format: input.format,
          fromDate: input.from,
          toDate: input.to,
          types: [...input.types],
        },
      }),

    findOwned: async (userId, id) => (await prisma.statementJob.findFirst({ where: { id, userId } })) ?? undefined,

    claim: async (id, leaseMs) => {
      const staleBefore = new Date(Date.now() - leaseMs);
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "wallet"."statement_jobs" SET "claimed_at" = now(), "attempts" = "attempts" + 1, "updated_at" = now()
        WHERE "id" = (
          SELECT "id" FROM "wallet"."statement_jobs"
          WHERE "status" = 'QUEUED'
            AND ("claimed_at" IS NULL OR "claimed_at" < ${staleBefore}::timestamptz)
            AND (${id ?? null}::uuid IS NULL OR "id" = ${id ?? null}::uuid)
          ORDER BY "created_at" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED)
        RETURNING "id"`;
      const claimed = rows[0];

      return claimed === undefined ? undefined : prisma.statementJob.findUniqueOrThrow({ where: { id: claimed.id } });
    },

    complete: async (id, storageKey) =>
      prisma.statementJob.update({
        where: { id },
        data: { status: "READY", storageKey, readyAt: new Date(), updatedAt: new Date() },
      }),

    fail: async (id, reason) =>
      prisma.statementJob.update({
        where: { id },
        data: { status: "FAILED", failureReason: reason.slice(0, 200), updatedAt: new Date() },
      }),

    release: async (id) => {
      await prisma.statementJob.update({ where: { id }, data: { claimedAt: null, updatedAt: new Date() } });
    },

    holderName: async (userId) => {
      const rows = await prisma.$queryRaw<{ display_name: string }[]>`
        SELECT "display_name" FROM "identity"."customers" WHERE "id" = ${userId}::uuid LIMIT 1`;

      return rows[0]?.display_name ?? "Customer";
    },

    ledger: async (userId, from, toExclusive, types, limit) => {
      const account = await prisma.walletAccount.findUnique({
        where: { ownerType_ownerId: { ownerType: "CUSTOMER", ownerId: userId } },
      });

      if (account === null) {
        return { openingBalance: 0n, lines: [], truncated: false };
      }

      const before = await prisma.walletTransaction.findFirst({
        where: { accountId: account.id, createdAt: { lt: from } },
        orderBy: { sequence: "desc" },
      });

      const rows = await prisma.$queryRaw<
        {
          created_at: Date;
          type: LedgerEntryType;
          amount: bigint;
          balance_after: bigint;
          reference: string | null;
          note: string | null;
        }[]
      >`
        SELECT "created_at", "type"::text AS "type", "amount", "balance_after", "reference", "note"
        FROM "wallet"."wallet_transactions"
        WHERE "account_id" = ${account.id}::uuid
          AND "created_at" >= ${from}::timestamptz AND "created_at" < ${toExclusive}::timestamptz
          AND (cardinality(${[...types]}::text[]) = 0 OR "type"::text = ANY(${[...types]}::text[]))
        ORDER BY "sequence" ASC
        LIMIT ${limit + 1}::int`;

      return {
        openingBalance: before?.balanceAfter ?? 0n,
        truncated: rows.length > limit,
        lines: rows.slice(0, limit).map((row) => ({
          createdAt: row.created_at,
          type: row.type,
          amount: row.amount,
          balanceAfter: row.balance_after,
          reference: row.reference,
          note: row.note,
        })),
      };
    },
  };
}
