// A period's figures are always an aggregate of its entries. `operator_result` is written as computed,
// negative included; nothing is debited anywhere to cover it.

import type { Prisma, PrismaClient } from "../databases/index.js";
import type { OperatorRepository } from "../interfaces/index.js";
import type {
  CommissionLedgerRecord,
  OperatorPeriodRecord,
  OperatorSummaryRecord,
} from "../models/index.js";
import {
  basisPointsToPercentText,
  percentToBasisPoints,
  splitCommission,
} from "../utils/index.js";
import { toCommissionLedger } from "./commission.repository.js";
import type { CommissionLedgerRow } from "./commission.repository.js";
import { insertNextPeriod, lockOpenPeriod, lockOrOpenPeriod, toPeriod } from "./period.sql.js";
import type { PeriodRow } from "./period.sql.js";

interface AggregateRow {
  readonly gross_stakes: bigint;
  readonly gross_payouts: bigint;
  readonly operator_result: bigint;
  readonly operator_result_rate: string;
  readonly settled_bets: number;
  readonly void_bets: number;
  readonly refunded_stakes: bigint;
}

interface ClosedRow extends AggregateRow, PeriodRow {}

interface ShopAggregateRow {
  readonly shop_id: string;
  readonly gross_stakes: bigint;
  readonly gross_payouts: bigint;
}

interface ShareRow {
  readonly shop_id: string | null;
  readonly shop_share_percent: string;
}

type Executor = Pick<Prisma.TransactionClient, "$queryRaw">;

// A void bet is a refund: neither a stake taken nor a payout made. The rate is clamped to NUMERIC(9,6).
async function aggregate(executor: Executor, periodId: string): Promise<AggregateRow> {
  const rows = await executor.$queryRaw<AggregateRow[]>`
    WITH totals AS (
      SELECT COALESCE(SUM(stake) FILTER (WHERE outcome <> 'VOID'), 0)::bigint AS gross_stakes,
             COALESCE(SUM(payout) FILTER (WHERE outcome = 'WON'), 0)::bigint AS gross_payouts,
             (COUNT(*) FILTER (WHERE outcome <> 'VOID'))::int AS settled_bets,
             (COUNT(*) FILTER (WHERE outcome = 'VOID'))::int AS void_bets,
             COALESCE(SUM(stake) FILTER (WHERE outcome = 'VOID'), 0)::bigint AS refunded_stakes
      FROM settlement.operator_ledger_entries
      WHERE period_id = ${periodId}
    )
    SELECT gross_stakes, gross_payouts,
           (gross_stakes - gross_payouts)::bigint AS operator_result,
           CASE WHEN gross_stakes = 0 THEN '0.000000'
                ELSE GREATEST(-999.999999, LEAST(999.999999,
                       ROUND((gross_stakes - gross_payouts)::numeric / gross_stakes, 6)))::text
           END AS operator_result_rate,
           settled_bets, void_bets, refunded_stakes
    FROM totals`;

  const row = rows[0];

  if (row === undefined) {
    throw new Error("The period aggregate returned no row.");
  }

  return row;
}

function toSummary(period: OperatorPeriodRecord, row: AggregateRow): OperatorSummaryRecord {
  return {
    period,
    grossStakes: row.gross_stakes,
    grossPayouts: row.gross_payouts,
    operatorResult: row.operator_result,
    operatorResultRate: row.operator_result_rate,
    settledBets: row.settled_bets,
    voidBets: row.void_bets,
    refundedStakes: row.refunded_stakes,
  };
}

export function createOperatorRepository(prisma: PrismaClient): OperatorRepository {
  return {
    ensureOpenPeriod: async (now) => prisma.$transaction(async (tx) => lockOrOpenPeriod(tx, now)),

    summarise: async (period) => toSummary(period, await aggregate(prisma, period.id)),

    listClosed: async (limit) => {
      const rows = await prisma.$queryRaw<ClosedRow[]>`
        SELECT p.id, p.kind, p.status, p.starts_at, p.ends_at,
               l.gross_stakes, l.gross_payouts, l.operator_result,
               l.operator_result_rate::text AS operator_result_rate,
               l.settled_bets, l.void_bets, l.refunded_stakes
        FROM settlement.operator_ledger l
        JOIN settlement.operator_periods p ON p.id = l.period_id
        ORDER BY p.ends_at DESC, p.id DESC
        LIMIT ${limit}`;

      return rows.map((row) => toSummary(toPeriod(row), row));
    },

    listPeriods: async (limit) => {
      const rows = await prisma.$queryRaw<PeriodRow[]>`
        SELECT id, kind, status, starts_at, ends_at
        FROM settlement.operator_periods
        ORDER BY starts_at DESC, id DESC
        LIMIT ${limit}`;

      return rows.map(toPeriod);
    },

    closePeriod: async (input) =>
      prisma.$transaction(async (tx) => {
        const open = await lockOpenPeriod(tx, "update");

        if (
          open === undefined ||
          (input.expectedPeriodId !== undefined && open.id !== input.expectedPeriodId)
        ) {
          return undefined;
        }

        const closedRows = await tx.$queryRaw<PeriodRow[]>`
          UPDATE settlement.operator_periods
          SET status = 'CLOSED', ends_at = GREATEST(${input.now}, starts_at)
          WHERE id = ${open.id} AND status = 'OPEN'
          RETURNING id, kind, status, starts_at, ends_at`;

        const closedRow = closedRows[0];

        if (closedRow === undefined) {
          return undefined;
        }

        const totals = await aggregate(tx, open.id);

        await tx.$executeRaw`
          INSERT INTO settlement.operator_ledger
            (period_id, gross_stakes, gross_payouts, operator_result, operator_result_rate,
             settled_bets, void_bets, refunded_stakes, status)
          VALUES
            (${open.id}, ${totals.gross_stakes}, ${totals.gross_payouts}, ${totals.operator_result},
             ${totals.operator_result_rate}::numeric(9,6), ${totals.settled_bets}, ${totals.void_bets},
             ${totals.refunded_stakes}, 'CLOSED')`;

        const shops = await tx.$queryRaw<ShopAggregateRow[]>`
          SELECT shop_id,
                 COALESCE(SUM(stake) FILTER (WHERE outcome <> 'VOID'), 0)::bigint AS gross_stakes,
                 COALESCE(SUM(payout) FILTER (WHERE outcome = 'WON'), 0)::bigint AS gross_payouts
          FROM settlement.operator_ledger_entries
          WHERE period_id = ${open.id} AND shop_id IS NOT NULL
          GROUP BY shop_id
          ORDER BY shop_id`;

        const commissions: CommissionLedgerRecord[] = [];

        if (shops.length > 0) {
          const shopIds = shops.map((shop) => shop.shop_id);

          // The shop's own latest version in force at the close, else the platform default.
          const shares = await tx.$queryRaw<ShareRow[]>`
            SELECT DISTINCT ON (shop_id) shop_id, shop_share_percent::text AS shop_share_percent
            FROM settlement.commission_config
            WHERE effective_from <= now() AND (shop_id IS NULL OR shop_id = ANY(${shopIds}::uuid[]))
            ORDER BY shop_id, effective_from DESC, id DESC`;

          const platformDefault = shares.find((share) => share.shop_id === null);

          for (const shop of shops) {
            const share = shares.find((entry) => entry.shop_id === shop.shop_id) ?? platformDefault;

            if (share === undefined) {
              throw new Error("No commission configuration is in force.");
            }

            const result = shop.gross_stakes - shop.gross_payouts;
            const split = splitCommission(result, percentToBasisPoints(share.shop_share_percent));

            const inserted = await tx.$queryRaw<CommissionLedgerRow[]>`
              INSERT INTO settlement.commission_ledger
                (period_id, shop_id, gross_stakes, gross_payouts, gross_operator_result,
                 shop_share_percent, shop_share_amount, platform_share_percent, platform_share_amount)
              VALUES
                (${open.id}, ${shop.shop_id}::uuid, ${shop.gross_stakes}, ${shop.gross_payouts}, ${result},
                 ${basisPointsToPercentText(split.shopShareBasisPoints)}::numeric(5,2), ${split.shopShareAmount},
                 ${basisPointsToPercentText(split.platformShareBasisPoints)}::numeric(5,2),
                 ${split.platformShareAmount})
              RETURNING id, period_id, shop_id, gross_stakes, gross_payouts, gross_operator_result,
                        shop_share_percent::text AS shop_share_percent, shop_share_amount,
                        platform_share_percent::text AS platform_share_percent, platform_share_amount,
                        created_at`;

            const row = inserted[0];

            if (row !== undefined) {
              commissions.push(toCommissionLedger(row));
            }
          }
        }

        await insertNextPeriod(tx, input.nextKind, input.now);

        const opened = await lockOpenPeriod(tx, "share");

        if (opened === undefined) {
          throw new Error("The next reporting period could not be opened.");
        }

        const result = {
          closed: toSummary(toPeriod(closedRow), totals),
          opened,
          commissions,
        };

        await input.confirm?.(result, open);

        return result;
      }),
  };
}
