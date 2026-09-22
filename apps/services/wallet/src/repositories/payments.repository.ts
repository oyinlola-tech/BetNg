import { randomUUID } from "node:crypto";
import type { PaymentDirection, PaymentMethod, PaymentStatus } from "@betng/contracts";
import { isDomainError } from "@zudojs/errors";
import { toDatabaseErrorInfo } from "@zudojs/database";
import type { Logger } from "@betng/service-kit";
import {
  IN_FLIGHT_STATUSES,
  LEDGER_KEY,
  PAYMENT_TRANSITIONS,
  SAFE_REASON,
} from "../constants/payments.constant.js";
import type { ProviderId } from "../constants/payments.constant.js";
import { join, sql } from "../databases/index.js";
import type { Sql } from "../databases/index.js";
import { paymentErrors, WalletDatabaseError } from "../errors/index.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { DepositInstructions, ProviderOutcome } from "../providers/index.js";
import { pageWindow } from "../utils/page.util.js";
import { postWithinTransaction } from "./ledger.js";
import { TRANSACTION_OPTIONS } from "./wallet.repository.js";

export type PaymentRow = Prisma.PaymentGetPayload<Record<string, never>>;

export type ReviewStatus = "NOT_REQUIRED" | "REQUIRED" | "APPROVED" | "REJECTED";

export interface NewDeposit {
  readonly userId: string;
  readonly reference: string;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly provider: ProviderId;
  readonly idempotencyKey: string;
  readonly expiresAt: Date;
}

export interface NewWithdrawal {
  readonly userId: string;
  readonly accountId: string;
  readonly reference: string;
  readonly amount: number;
  readonly fee: number;
  readonly provider: ProviderId;
  readonly idempotencyKey: string;
  readonly bankAccountId: string;
  readonly reviewStatus: ReviewStatus;
}

export interface Settled {
  readonly payment: PaymentRow;
  /** The status this call moved the payment to, when it moved it. */
  readonly transitioned: PaymentStatus | undefined;
}

export interface HistoryFilter {
  readonly page: number;
  readonly pageSize: number;
  readonly direction?: PaymentDirection | undefined;
  readonly status?: PaymentStatus | undefined;
}

export interface AdminFilter extends HistoryFilter {
  readonly provider?: ProviderId | undefined;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
  readonly search?: string | undefined;
}

export interface AdminPaymentRow extends PaymentRow {
  readonly userEmail: string;
}

export interface OverviewFigures {
  readonly depositsToday: bigint;
  readonly withdrawalsToday: bigint;
  readonly pendingDeposits: number;
  readonly pendingWithdrawals: number;
  readonly failedToday: number;
}

export interface PaymentsRepository {
  findByKey(userId: string, idempotencyKey: string): Promise<PaymentRow | undefined>;
  findByReference(reference: string): Promise<PaymentRow | undefined>;
  findOwned(userId: string, reference: string, direction: PaymentDirection): Promise<PaymentRow | undefined>;
  insertDeposit(input: NewDeposit): Promise<PaymentRow>;
  recordInitiation(
    id: string,
    result: { providerReference?: string | undefined; checkoutUrl?: string | undefined; instructions?: DepositInstructions | undefined },
  ): Promise<PaymentRow>;
  recordInitiationFailure(id: string, errorCode: string, reason: string): Promise<PaymentRow>;
  nextCheck(id: string): Promise<number>;
  settleDeposit(id: string, accountId: string, outcome: ProviderOutcome, options: { readonly expire: boolean; readonly eventId?: string | undefined }): Promise<Settled>;
  flag(id: string, reason: string, eventId?: string): Promise<PaymentRow>;
  createWithdrawal(input: NewWithdrawal): Promise<PaymentRow>;
  claimTransfer(id: string): Promise<{ readonly payment: PaymentRow; readonly retry: boolean } | undefined>;
  recordTransfer(id: string, providerReference: string | undefined): Promise<void>;
  settleWithdrawal(id: string, accountId: string, outcome: ProviderOutcome, eventId?: string): Promise<Settled>;
  failWithdrawal(id: string, accountId: string, reason: string): Promise<Settled>;
  review(
    id: string,
    accountId: string,
    decision: "APPROVE" | "REJECT",
    reviewer: { readonly id: string; readonly reason: string },
  ): Promise<Settled>;
  history(userId: string, filter: HistoryFilter): Promise<{ readonly items: readonly PaymentRow[]; readonly total: number }>;
  inFlightWithdrawals(userId: string): Promise<bigint>;
  usedToday(userId: string, direction: PaymentDirection, since: Date): Promise<bigint>;
  dueDeposits(now: Date, limit: number): Promise<readonly PaymentRow[]>;
  dueWithdrawals(limit: number): Promise<readonly PaymentRow[]>;
  hasInFlightWithdrawal(bankAccountId: string): Promise<boolean>;
  adminPage(filter: AdminFilter): Promise<{ readonly items: readonly AdminPaymentRow[]; readonly total: number }>;
  adminOne(reference: string): Promise<AdminPaymentRow | undefined>;
  overview(since: Date): Promise<OverviewFigures>;
  customerContact(userId: string): Promise<{ readonly email: string; readonly status: string } | undefined>;
  recordWebhookEvent(provider: ProviderId, eventId: string, eventType: string, reference: string | undefined): Promise<"NEW" | "PENDING" | "DONE">;
  completeWebhookEvent(provider: ProviderId, eventId: string, outcome: string): Promise<void>;
}

function isTerminal(status: string): boolean {
  return PAYMENT_TRANSITIONS[status as PaymentStatus].length === 0 || status === "CONFIRMED";
}

function canMove(from: string, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from as PaymentStatus].includes(to);
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function likePattern(term: string): string {
  return `%${term.replace(/[!%_]/gu, (character) => `!${character}`)}%`;
}

interface RawPayment {
  readonly id: string;
  readonly reference: string;
  readonly user_id: string;
  readonly direction: string;
  readonly status: string;
  readonly amount: bigint;
  readonly fee: bigint;
  readonly net_amount: bigint;
  readonly currency: string;
  readonly method: string | null;
  readonly provider: string;
  readonly provider_reference: string | null;
  readonly provider_event_ids: string[];
  readonly checkout_url: string | null;
  readonly instructions: Prisma.JsonValue;
  readonly expires_at: Date | null;
  readonly idempotency_key: string;
  readonly bank_account_id: string | null;
  readonly failure_reason: string | null;
  readonly error_code: string | null;
  readonly review_status: string;
  readonly reviewed_by: string | null;
  readonly reviewed_at: Date | null;
  readonly review_reason: string | null;
  readonly flagged_at: Date | null;
  readonly flag_reason: string | null;
  readonly provider_checks: number;
  readonly transfer_requested_at: Date | null;
  readonly ledger_entry_id: string | null;
  readonly reversal_entry_id: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly completed_at: Date | null;
  readonly user_email?: string | null;
}

function fromRaw(row: RawPayment): PaymentRow {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    direction: row.direction,
    status: row.status,
    amount: row.amount,
    fee: row.fee,
    netAmount: row.net_amount,
    currency: row.currency,
    method: row.method,
    provider: row.provider,
    providerReference: row.provider_reference,
    providerEventIds: row.provider_event_ids,
    checkoutUrl: row.checkout_url,
    instructions: row.instructions,
    expiresAt: row.expires_at,
    idempotencyKey: row.idempotency_key,
    bankAccountId: row.bank_account_id,
    failureReason: row.failure_reason,
    errorCode: row.error_code,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewReason: row.review_reason,
    flaggedAt: row.flagged_at,
    flagReason: row.flag_reason,
    providerChecks: row.provider_checks,
    transferRequestedAt: row.transfer_requested_at,
    ledgerEntryId: row.ledger_entry_id,
    reversalEntryId: row.reversal_entry_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function createPaymentsRepository(prisma: PrismaClient, logger: Logger): PaymentsRepository {
  async function guarded<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isDomainError(error) || isUniqueViolation(error)) {
        throw error;
      }

      logger.error("Payments database operation failed", { operation, error: { ...toDatabaseErrorInfo(error) } });

      throw new WalletDatabaseError(error);
    }
  }

  async function lock(tx: Prisma.TransactionClient, id: string): Promise<PaymentRow> {
    const rows = await tx.$queryRaw<RawPayment[]>`
      SELECT * FROM "wallet"."payments" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = rows[0];

    if (row === undefined) {
      throw new Error("The payment disappeared.");
    }

    return fromRaw(row);
  }

  function withEvent(payment: PaymentRow, eventId: string | undefined): { providerEventIds?: string[] } {
    return eventId === undefined || payment.providerEventIds.includes(eventId) || payment.providerEventIds.length >= 50
      ? {}
      : { providerEventIds: [...payment.providerEventIds, eventId] };
  }

  async function move(
    tx: Prisma.TransactionClient,
    payment: PaymentRow,
    to: PaymentStatus,
    data: Prisma.PaymentUpdateInput,
  ): Promise<Settled> {
    if (!canMove(payment.status, to)) {
      throw new Error(`Refusing payment transition ${payment.status} → ${to}.`);
    }

    const final = PAYMENT_TRANSITIONS[to].length === 0 || to === "CONFIRMED";
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { ...data, status: to, ...(final ? { completedAt: new Date() } : {}) },
    });

    return { payment: updated, transitioned: to };
  }

  async function reverseWithdrawal(tx: Prisma.TransactionClient, payment: PaymentRow, accountId: string): Promise<string> {
    const reversal = await postWithinTransaction(tx, {
      accountId,
      type: "WITHDRAWAL_REVERSAL",
      amount: payment.amount,
      idempotencyKey: LEDGER_KEY.withdrawalReversal(payment.id),
      reference: payment.reference,
    });

    return reversal.entry.id;
  }

  async function flagWithin(tx: Prisma.TransactionClient, payment: PaymentRow, reason: string, eventId?: string): Promise<Settled> {
    const data: Prisma.PaymentUpdateInput = {
      ...withEvent(payment, eventId),
      ...(payment.flaggedAt === null ? { flaggedAt: new Date(), flagReason: reason.slice(0, 200) } : {}),
    };

    if (payment.status === "INITIATED" || payment.status === "PENDING") {
      return move(tx, payment, "PROCESSING", data);
    }

    return { payment: await tx.payment.update({ where: { id: payment.id }, data }), transitioned: undefined };
  }

  async function unchanged(tx: Prisma.TransactionClient, payment: PaymentRow, eventId: string | undefined): Promise<Settled> {
    const data = withEvent(payment, eventId);

    return {
      payment: data.providerEventIds === undefined ? payment : await tx.payment.update({ where: { id: payment.id }, data }),
      transitioned: undefined,
    };
  }

  const repository: PaymentsRepository = {
    findByKey: async (userId, idempotencyKey) =>
      (await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } })) ?? undefined,

    findByReference: async (reference) => (await prisma.payment.findUnique({ where: { reference } })) ?? undefined,

    findOwned: async (userId, reference, direction) =>
      (await prisma.payment.findFirst({ where: { reference, userId, direction } })) ?? undefined,

    insertDeposit: async (input) =>
      prisma.payment.create({
        data: {
          id: randomUUID(),
          reference: input.reference,
          userId: input.userId,
          direction: "DEPOSIT",
          status: "INITIATED",
          amount: BigInt(input.amount),
          fee: 0n,
          netAmount: BigInt(input.amount),
          method: input.method,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
          expiresAt: input.expiresAt,
        },
      }),

    recordInitiation: async (id, result) =>
      prisma.$transaction(async (tx) => {
        const payment = await lock(tx, id);
        const data: Prisma.PaymentUpdateInput = {
          providerReference: result.providerReference ?? null,
          checkoutUrl: result.checkoutUrl ?? null,
          ...(result.instructions === undefined
            ? {}
            : { instructions: { title: result.instructions.title, lines: [...result.instructions.lines] } }),
        };

        return payment.status === "INITIATED"
          ? (await move(tx, payment, "PENDING", data)).payment
          : tx.payment.update({ where: { id }, data });
      }, TRANSACTION_OPTIONS),

    recordInitiationFailure: async (id, errorCode, reason) =>
      prisma.$transaction(async (tx) => {
        const payment = await lock(tx, id);

        if (payment.status !== "INITIATED") {
          return payment;
        }

        return (await move(tx, payment, "FAILED", { errorCode, failureReason: reason })).payment;
      }, TRANSACTION_OPTIONS),

    nextCheck: async (id) => {
      const rows = await prisma.$queryRaw<{ provider_checks: number }[]>`
        UPDATE "wallet"."payments" SET "provider_checks" = "provider_checks" + 1
        WHERE "id" = ${id}::uuid RETURNING "provider_checks"`;

      return rows[0]?.provider_checks ?? 1;
    },

    settleDeposit: async (id, accountId, outcome, options) =>
      guarded("settleDeposit", async () =>
        prisma.$transaction(async (tx) => {
          const payment = await lock(tx, id);

          if (isTerminal(payment.status)) {
            if (outcome.kind === "SUCCEEDED" && payment.status !== "CONFIRMED" && payment.flaggedAt === null) {
              return flagWithin(tx, payment, SAFE_REASON.LATE_SUCCESS, options.eventId);
            }

            if (outcome.kind === "REVERSED" && payment.status === "CONFIRMED" && payment.flaggedAt === null) {
              return flagWithin(tx, payment, "The provider reported the charge reversed after it was credited.", options.eventId);
            }

            return unchanged(tx, payment, options.eventId);
          }

          if (payment.flaggedAt !== null) {
            return unchanged(tx, payment, options.eventId);
          }

          const event = withEvent(payment, options.eventId);

          switch (outcome.kind) {
            case "SUCCEEDED": {
              if (BigInt(outcome.amount) !== payment.amount || outcome.currency.toUpperCase() !== payment.currency) {
                return flagWithin(tx, payment, SAFE_REASON.AMOUNT_MISMATCH, options.eventId);
              }

              const credit = await postWithinTransaction(tx, {
                accountId,
                type: "DEPOSIT",
                amount: payment.amount,
                idempotencyKey: LEDGER_KEY.deposit(payment.id),
                reference: payment.reference,
              });

              return move(tx, payment, "CONFIRMED", { ...event, ledgerEntryId: credit.entry.id });
            }
            case "FAILED":
            case "REVERSED":
              return move(tx, payment, "FAILED", { ...event, failureReason: SAFE_REASON.DEPOSIT_FAILED });
            case "EXPIRED":
              return move(tx, payment, "EXPIRED", { ...event, failureReason: SAFE_REASON.DEPOSIT_EXPIRED });
            case "PROCESSING":
              return payment.status === "PROCESSING" ? unchanged(tx, payment, options.eventId) : move(tx, payment, "PROCESSING", event);
            case "PENDING":
            case "NOT_FOUND":
              return options.expire && payment.status !== "PROCESSING"
                ? move(tx, payment, "EXPIRED", { ...event, failureReason: SAFE_REASON.DEPOSIT_EXPIRED })
                : unchanged(tx, payment, options.eventId);
          }
        }, TRANSACTION_OPTIONS),
      ),

    flag: async (id, reason, eventId) =>
      guarded("flag", async () =>
        prisma.$transaction(async (tx) => (await flagWithin(tx, await lock(tx, id), reason, eventId)).payment, TRANSACTION_OPTIONS),
      ),

    createWithdrawal: async (input) =>
      prisma.$transaction(async (tx) => {
        const id = randomUUID();
        const accounts = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "wallet"."bank_accounts"
          WHERE "id" = ${input.bankAccountId}::uuid AND "user_id" = ${input.userId}::uuid AND "deleted_at" IS NULL
          FOR SHARE`;

        if (accounts.length === 0) {
          throw paymentErrors.notFound("That bank account is not on your profile.");
        }

        await tx.payment.create({
          data: {
            id,
            reference: input.reference,
            userId: input.userId,
            direction: "WITHDRAWAL",
            status: "PENDING",
            amount: BigInt(input.amount),
            fee: BigInt(input.fee),
            netAmount: BigInt(input.amount - input.fee),
            method: "BANK_TRANSFER",
            provider: input.provider,
            idempotencyKey: input.idempotencyKey,
            bankAccountId: input.bankAccountId,
            reviewStatus: input.reviewStatus,
          },
        });

        const debit = await postWithinTransaction(tx, {
          accountId: input.accountId,
          type: "WITHDRAWAL",
          amount: -BigInt(input.amount),
          idempotencyKey: LEDGER_KEY.withdrawal(id),
          reference: input.reference,
        });

        return tx.payment.update({ where: { id }, data: { ledgerEntryId: debit.entry.id } });
      }, TRANSACTION_OPTIONS),

    claimTransfer: async (id) =>
      guarded("claimTransfer", async () =>
        prisma.$transaction(async (tx) => {
          const payment = await lock(tx, id);
          const staleBefore = Date.now() - 2 * 60_000;

          if (
            payment.direction !== "WITHDRAWAL" ||
            payment.status !== "PENDING" ||
            payment.flaggedAt !== null ||
            (payment.reviewStatus !== "NOT_REQUIRED" && payment.reviewStatus !== "APPROVED") ||
            (payment.transferRequestedAt !== null && payment.transferRequestedAt.getTime() > staleBefore)
          ) {
            return undefined;
          }

          const updated = await tx.payment.update({ where: { id }, data: { transferRequestedAt: new Date() } });

          return { payment: updated, retry: payment.transferRequestedAt !== null };
        }, TRANSACTION_OPTIONS),
      ),

    recordTransfer: async (id, providerReference) => {
      if (providerReference !== undefined) {
        await prisma.payment.update({ where: { id }, data: { providerReference: providerReference.slice(0, 120) } });
      }
    },

    settleWithdrawal: async (id, accountId, outcome, eventId) =>
      guarded("settleWithdrawal", async () =>
        prisma.$transaction(async (tx) => {
          const payment = await lock(tx, id);
          const event = withEvent(payment, eventId);
          const open = payment.status === "PENDING" || payment.status === "PROCESSING";

          switch (outcome.kind) {
            case "SUCCEEDED":
              if (!open) {
                return unchanged(tx, payment, eventId);
              }

              if (BigInt(outcome.amount) !== payment.netAmount) {
                return flagWithin(tx, payment, "The transferred amount does not match the withdrawal.", eventId);
              }

              return move(tx, payment, "CONFIRMED", event);
            case "FAILED":
            case "EXPIRED":
              if (!open) {
                return unchanged(tx, payment, eventId);
              }

              return move(tx, payment, "FAILED", {
                ...event,
                failureReason: SAFE_REASON.TRANSFER_FAILED,
                reversalEntryId: await reverseWithdrawal(tx, payment, accountId),
              });
            case "REVERSED":
              if (open) {
                return move(tx, payment, "FAILED", {
                  ...event,
                  failureReason: SAFE_REASON.TRANSFER_REVERSED,
                  reversalEntryId: await reverseWithdrawal(tx, payment, accountId),
                });
              }

              if (payment.status === "CONFIRMED") {
                return move(tx, payment, "REVERSED", {
                  ...event,
                  failureReason: SAFE_REASON.TRANSFER_REVERSED,
                  reversalEntryId: await reverseWithdrawal(tx, payment, accountId),
                });
              }

              return unchanged(tx, payment, eventId);
            case "PROCESSING":
              return payment.status === "PENDING" ? move(tx, payment, "PROCESSING", event) : unchanged(tx, payment, eventId);
            case "PENDING":
            case "NOT_FOUND":
              return unchanged(tx, payment, eventId);
          }
        }, TRANSACTION_OPTIONS),
      ),

    failWithdrawal: async (id, accountId, reason) =>
      guarded("failWithdrawal", async () =>
        prisma.$transaction(async (tx) => {
          const payment = await lock(tx, id);

          if (payment.status !== "PENDING" && payment.status !== "PROCESSING") {
            return { payment, transitioned: undefined };
          }

          return move(tx, payment, "FAILED", {
            failureReason: reason,
            reversalEntryId: await reverseWithdrawal(tx, payment, accountId),
          });
        }, TRANSACTION_OPTIONS),
      ),

    review: async (id, accountId, decision, reviewer) =>
      guarded("review", async () =>
        prisma.$transaction(async (tx) => {
          const payment = await lock(tx, id);

          if (payment.direction !== "WITHDRAWAL" || payment.reviewStatus !== "REQUIRED" || payment.status !== "PENDING") {
            return { payment, transitioned: undefined };
          }

          const review = { reviewedBy: reviewer.id, reviewedAt: new Date(), reviewReason: reviewer.reason };

          if (decision === "APPROVE") {
            const updated = await tx.payment.update({ where: { id }, data: { ...review, reviewStatus: "APPROVED" } });

            return { payment: updated, transitioned: "PENDING" as const };
          }

          return move(tx, payment, "CANCELLED", {
            ...review,
            reviewStatus: "REJECTED",
            failureReason: SAFE_REASON.REVIEW_REJECTED,
            reversalEntryId: await reverseWithdrawal(tx, payment, accountId),
          });
        }, TRANSACTION_OPTIONS),
      ),

    history: async (userId, filter) => {
      const where: Prisma.PaymentWhereInput = {
        userId,
        ...(filter.direction === undefined ? {} : { direction: filter.direction }),
        ...(filter.status === undefined ? {} : { status: filter.status }),
      };
      const paging = pageWindow(filter.page, filter.pageSize);
      const [items, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: paging.offset,
          take: paging.pageSize,
        }),
        prisma.payment.count({ where }),
      ]);

      return { items, total };
    },

    inFlightWithdrawals: async (userId) => {
      const rows = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COALESCE(SUM("amount"), 0)::bigint AS "total" FROM "wallet"."payments"
        WHERE "user_id" = ${userId}::uuid AND "direction" = 'WITHDRAWAL'
          AND "status" = ANY(${[...IN_FLIGHT_STATUSES]}::text[])`;

      return rows[0]?.total ?? 0n;
    },

    usedToday: async (userId, direction, since) => {
      const rows = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COALESCE(SUM("amount"), 0)::bigint AS "total" FROM "wallet"."payments"
        WHERE "user_id" = ${userId}::uuid AND "direction" = ${direction}
          AND "created_at" >= ${since}::timestamptz
          AND "status" IN ('INITIATED', 'PENDING', 'PROCESSING', 'CONFIRMED')`;

      return rows[0]?.total ?? 0n;
    },

    dueDeposits: async (now, limit) =>
      prisma.payment.findMany({
        where: { direction: "DEPOSIT", status: { in: ["INITIATED", "PENDING"] }, flaggedAt: null, expiresAt: { lt: now } },
        orderBy: { expiresAt: "asc" },
        take: limit,
      }),

    dueWithdrawals: async (limit) =>
      prisma.payment.findMany({
        where: {
          direction: "WITHDRAWAL",
          flaggedAt: null,
          OR: [{ status: "PROCESSING" }, { status: "PENDING", reviewStatus: { in: ["NOT_REQUIRED", "APPROVED"] } }],
        },
        orderBy: { updatedAt: "asc" },
        take: limit,
      }),

    hasInFlightWithdrawal: async (bankAccountId) =>
      (await prisma.payment.count({
        where: { bankAccountId, direction: "WITHDRAWAL", status: { in: [...IN_FLIGHT_STATUSES] } },
      })) > 0,

    adminPage: async (filter) => {
      const conditions: Sql[] = [sql`TRUE`];

      if (filter.direction !== undefined) conditions.push(sql`p."direction" = ${filter.direction}`);
      if (filter.status !== undefined) conditions.push(sql`p."status" = ${filter.status}`);
      if (filter.provider !== undefined) conditions.push(sql`p."provider" = ${filter.provider}`);
      if (filter.from !== undefined) conditions.push(sql`p."created_at" >= ${filter.from}::timestamptz`);
      if (filter.to !== undefined) conditions.push(sql`p."created_at" <= ${filter.to}::timestamptz`);

      if (filter.search !== undefined) {
        const pattern = likePattern(filter.search);

        conditions.push(sql`(p."reference" ILIKE ${pattern} ESCAPE '!' OR c."email" ILIKE ${pattern} ESCAPE '!')`);
      }

      const where = join(conditions, " AND ");
      const paging = pageWindow(filter.page, filter.pageSize);
      const [rows, counted] = await Promise.all([
        prisma.$queryRaw<RawPayment[]>`
          SELECT p.*, c."email" AS "user_email"
          FROM "wallet"."payments" p
          LEFT JOIN "identity"."customers" c ON c."id" = p."user_id"
          WHERE ${where}
          ORDER BY p."created_at" DESC, p."id" DESC
          LIMIT ${paging.pageSize}::int OFFSET ${paging.offset}::bigint`,
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS "total"
          FROM "wallet"."payments" p
          LEFT JOIN "identity"."customers" c ON c."id" = p."user_id"
          WHERE ${where}`,
      ]);

      return {
        items: rows.map((row) => ({ ...fromRaw(row), userEmail: row.user_email ?? "" })),
        total: counted[0]?.total ?? 0,
      };
    },

    adminOne: async (reference) => {
      const rows = await prisma.$queryRaw<RawPayment[]>`
        SELECT p.*, c."email" AS "user_email"
        FROM "wallet"."payments" p
        LEFT JOIN "identity"."customers" c ON c."id" = p."user_id"
        WHERE p."reference" = ${reference}`;
      const row = rows[0];

      return row === undefined ? undefined : { ...fromRaw(row), userEmail: row.user_email ?? "" };
    },

    overview: async (since) => {
      const rows = await prisma.$queryRaw<
        {
          deposits_today: bigint;
          withdrawals_today: bigint;
          pending_deposits: number;
          pending_withdrawals: number;
          failed_today: number;
        }[]
      >`
        SELECT
          COALESCE(SUM("amount") FILTER (WHERE "direction" = 'DEPOSIT' AND "status" = 'CONFIRMED' AND "completed_at" >= ${since}::timestamptz), 0)::bigint AS "deposits_today",
          COALESCE(SUM("amount") FILTER (WHERE "direction" = 'WITHDRAWAL' AND "status" = 'CONFIRMED' AND "completed_at" >= ${since}::timestamptz), 0)::bigint AS "withdrawals_today",
          COUNT(*) FILTER (WHERE "direction" = 'DEPOSIT' AND "status" IN ('INITIATED', 'PENDING', 'PROCESSING'))::int AS "pending_deposits",
          COUNT(*) FILTER (WHERE "direction" = 'WITHDRAWAL' AND "status" IN ('INITIATED', 'PENDING', 'PROCESSING'))::int AS "pending_withdrawals",
          COUNT(*) FILTER (WHERE "status" = 'FAILED' AND "completed_at" >= ${since}::timestamptz)::int AS "failed_today"
        FROM "wallet"."payments"`;
      const row = rows[0];

      return {
        depositsToday: row?.deposits_today ?? 0n,
        withdrawalsToday: row?.withdrawals_today ?? 0n,
        pendingDeposits: row?.pending_deposits ?? 0,
        pendingWithdrawals: row?.pending_withdrawals ?? 0,
        failedToday: row?.failed_today ?? 0,
      };
    },

    customerContact: async (userId) => {
      const rows = await prisma.$queryRaw<{ email: string; status: string }[]>`
        SELECT "email", "status"::text AS "status" FROM "identity"."customers" WHERE "id" = ${userId}::uuid LIMIT 1`;

      return rows[0];
    },

    recordWebhookEvent: async (provider, eventId, eventType, reference) => {
      const inserted = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "wallet"."payment_webhook_events" ("id", "provider", "event_id", "event_type", "payment_reference")
        VALUES (${randomUUID()}::uuid, ${provider}, ${eventId}, ${eventType}, ${reference ?? null})
        ON CONFLICT ("provider", "event_id") DO NOTHING
        RETURNING "id"`;

      if (inserted.length > 0) {
        return "NEW";
      }

      const existing = await prisma.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider, eventId } } });

      return existing?.processedAt === null ? "PENDING" : "DONE";
    },

    completeWebhookEvent: async (provider, eventId, outcome) => {
      await prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider, eventId } },
        data: { processedAt: new Date(), outcome: outcome.slice(0, 40) },
      });
    },
  };

  const wrapped = {} as Record<string, unknown>;

  for (const [name, method] of Object.entries(repository)) {
    wrapped[name] = async (...args: unknown[]) =>
      guarded(name, async () => (method as (...inner: unknown[]) => Promise<unknown>)(...args));
  }

  return wrapped as unknown as PaymentsRepository;
}
