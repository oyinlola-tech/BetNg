import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { TimeRange } from "../interfaces/index.js";
import { TRANSACTION_OPTIONS } from "./wallet.repository.js";

export type ShiftRow = Prisma.CashierShiftGetPayload<Record<string, never>>;

export interface LedgerTotals {
  readonly sales: bigint;
  readonly payouts: bigint;
  readonly cancellations: bigint;
  readonly cashIn: bigint;
  readonly cashOut: bigint;
  readonly ticketsSold: number;
}

export interface NewShift {
  readonly shopId: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly openingFloat: number;
  readonly idempotencyKey: string;
}

export interface ShiftClosure {
  readonly closedAt: Date;
  readonly totals: Prisma.InputJsonObject;
  readonly counted: Prisma.InputJsonArray;
  readonly countedCash: bigint;
  readonly expectedCash: bigint;
  readonly note: string | undefined;
  readonly idempotencyKey: string;
}

export type CloseOutcome =
  | { readonly kind: "CLOSED"; readonly shift: ShiftRow }
  | { readonly kind: "NOT_OPEN"; readonly shift: ShiftRow }
  | { readonly kind: "MISSING" };

export interface FloatTransferRow {
  readonly id: string;
  readonly fromCashierId: string;
  readonly fromCashierName: string;
  readonly toCashierId: string;
  readonly toCashierName: string;
  readonly amount: bigint;
  readonly note: string;
  readonly createdAt: Date;
}

export interface ShiftsRepository {
  /** The cashier's display name when identity has them as an active cashier of that shop. */
  cashierOfShop(cashierId: string, shopId: string): Promise<string | undefined>;
  findOpen(cashierId: string): Promise<ShiftRow | undefined>;
  findOwned(id: string, cashierId: string): Promise<ShiftRow | undefined>;
  findByOpenKey(cashierId: string, key: string): Promise<ShiftRow | undefined>;
  open(input: NewShift): Promise<ShiftRow>;
  ledgerTotals(shopId: string, cashierId: string, from: Date, to: Date): Promise<LedgerTotals>;
  close(id: string, cashierId: string, closure: (shift: ShiftRow) => Promise<ShiftClosure>): Promise<CloseOutcome>;
  list(shopId: string, cashierId: string | undefined, range: TimeRange): Promise<readonly ShiftRow[]>;
  listTransfers(shopId: string, range: TimeRange, limit: number): Promise<readonly FloatTransferRow[]>;
}

export function createShiftsRepository(prisma: PrismaClient): ShiftsRepository {
  return {
    cashierOfShop: async (cashierId, shopId) => {
      const rows = await prisma.$queryRaw<{ display_name: string }[]>`
        SELECT "display_name" FROM "identity"."cashiers"
        WHERE "id" = ${cashierId}::uuid AND "shop_id" = ${shopId}::uuid AND "status"::text = 'ACTIVE'
        LIMIT 1`;

      return rows[0]?.display_name;
    },

    findOwned: async (id, cashierId) => (await prisma.cashierShift.findFirst({ where: { id, cashierId } })) ?? undefined,

    listTransfers: async (shopId, range, limit) => {
      // The cashier names come from the shifts, which already carry them, so identity is not asked.
      const rows = await prisma.$queryRaw<
        {
          id: string;
          from_cashier_id: string;
          from_name: string;
          to_cashier_id: string;
          to_name: string;
          amount: bigint;
          note: string;
          created_at: Date;
        }[]
      >`
        SELECT t."id",
               t."from_cashier_id", COALESCE(f."cashier_name", '') AS "from_name",
               t."to_cashier_id",   COALESCE(r."cashier_name", '') AS "to_name",
               t."amount", t."note", t."created_at"
          FROM "wallet"."shop_float_transfers" t
          LEFT JOIN "wallet"."cashier_shifts" f ON f."id" = t."from_shift_id"
          LEFT JOIN "wallet"."cashier_shifts" r ON r."id" = t."to_shift_id"
         WHERE t."shop_id" = ${shopId}::uuid
           AND t."created_at" >= ${range.from} AND t."created_at" <= ${range.to}
         ORDER BY t."created_at" DESC
         LIMIT ${limit}`;

      return rows.map((row) => ({
        id: row.id,
        fromCashierId: row.from_cashier_id,
        fromCashierName: row.from_name,
        toCashierId: row.to_cashier_id,
        toCashierName: row.to_name,
        amount: row.amount,
        note: row.note,
        createdAt: row.created_at,
      }));
    },

    findOpen: async (cashierId) =>
      (await prisma.cashierShift.findFirst({ where: { cashierId, status: { in: ["OPEN", "CLOSING"] } } })) ?? undefined,

    findByOpenKey: async (cashierId, key) =>
      (await prisma.cashierShift.findUnique({ where: { cashierId_openIdempotencyKey: { cashierId, openIdempotencyKey: key } } })) ??
      undefined,

    open: async (input) =>
      prisma.cashierShift.create({
        data: {
          id: randomUUID(),
          shopId: input.shopId,
          cashierId: input.cashierId,
          cashierName: input.cashierName.slice(0, 60),
          openingFloat: BigInt(input.openingFloat),
          openIdempotencyKey: input.idempotencyKey,
        },
      }),

    ledgerTotals: async (shopId, cashierId, from, to) => {
      const rows = await prisma.$queryRaw<
        { sales: bigint; payouts: bigint; cancellations: bigint; cash_in: bigint; cash_out: bigint; tickets_sold: number }[]
      >`
        SELECT
          COALESCE(SUM(t."amount") FILTER (WHERE t."type" = 'TICKET_SALE'), 0)::bigint AS "sales",
          COALESCE(-SUM(t."amount") FILTER (WHERE t."type" = 'TICKET_PAYOUT'), 0)::bigint AS "payouts",
          COALESCE(-SUM(t."amount") FILTER (WHERE t."type" = 'TICKET_CANCEL'), 0)::bigint AS "cancellations",
          COALESCE(SUM(t."amount") FILTER (WHERE t."type" = 'CASH_IN'), 0)::bigint AS "cash_in",
          COALESCE(-SUM(t."amount") FILTER (WHERE t."type" = 'CASH_OUT'), 0)::bigint AS "cash_out",
          COUNT(*) FILTER (WHERE t."type" = 'TICKET_SALE')::int AS "tickets_sold"
        FROM "wallet"."wallet_transactions" t
        JOIN "wallet"."wallet_accounts" a ON a."id" = t."account_id"
        WHERE a."owner_type" = 'SHOP' AND a."owner_id" = ${shopId}::uuid
          AND t."actor_id" = ${cashierId}
          AND t."created_at" >= ${from}::timestamptz AND t."created_at" <= ${to}::timestamptz`;
      const row = rows[0];

      return {
        sales: row?.sales ?? 0n,
        payouts: row?.payouts ?? 0n,
        cancellations: row?.cancellations ?? 0n,
        cashIn: row?.cash_in ?? 0n,
        cashOut: row?.cash_out ?? 0n,
        ticketsSold: row?.tickets_sold ?? 0,
      };
    },

    close: async (id, cashierId, closure) =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "wallet"."cashier_shifts"
          WHERE "id" = ${id}::uuid AND "cashier_id" = ${cashierId}::uuid FOR UPDATE`;

        if (rows.length === 0) {
          return { kind: "MISSING" } as const;
        }

        const shift = await tx.cashierShift.findUniqueOrThrow({ where: { id } });

        if (shift.status !== "OPEN") {
          return { kind: "NOT_OPEN", shift } as const;
        }

        const result = await closure(shift);

        const closed = await tx.cashierShift.update({
          where: { id },
          data: {
            status: "CLOSED",
            closedAt: result.closedAt,
            totals: result.totals,
            counted: result.counted,
            countedCash: result.countedCash,
            expectedCash: result.expectedCash,
            discrepancy: result.countedCash - result.expectedCash,
            discrepancyNote: result.note ?? null,
            closeIdempotencyKey: result.idempotencyKey,
          },
        });

        return { kind: "CLOSED", shift: closed } as const;
      }, TRANSACTION_OPTIONS),

    list: async (shopId, cashierId, range) =>
      prisma.cashierShift.findMany({
        where: {
          shopId,
          ...(cashierId === undefined ? {} : { cashierId }),
          openedAt: { gte: range.from, lt: range.to },
        },
        orderBy: { openedAt: "desc" },
        take: 200,
      }),
  };
}
