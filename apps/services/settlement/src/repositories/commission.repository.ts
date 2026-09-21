import { sql } from "../databases/index.js";
import type { Prisma, PrismaClient } from "../databases/index.js";
import type { CommissionRepository } from "../interfaces/index.js";
import type { CommissionConfigRecord, CommissionLedgerRecord } from "../models/index.js";
import { basisPointsToPercentText } from "../utils/index.js";

interface ConfigRow {
  readonly id: string;
  readonly shop_id: string | null;
  readonly shop_share_percent: string;
  readonly effective_from: Date;
  readonly created_by: string;
  readonly reason: string;
}

export interface CommissionLedgerRow {
  readonly id: string;
  readonly period_id: string;
  readonly shop_id: string;
  readonly gross_stakes: bigint;
  readonly gross_payouts: bigint;
  readonly gross_operator_result: bigint;
  readonly shop_share_percent: string;
  readonly shop_share_amount: bigint;
  readonly platform_share_percent: string;
  readonly platform_share_amount: bigint;
  readonly created_at: Date;
}

const CONFIG_COLUMNS = sql`
  id, shop_id, shop_share_percent::text AS shop_share_percent, effective_from, created_by, reason`;

// Serialises writers so the audited "before" is the version the new row really replaces.
const CONFIG_LOCK_KEY = "settlement.commission_config";

function toConfig(row: ConfigRow): CommissionConfigRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    shopSharePercent: row.shop_share_percent,
    effectiveFrom: row.effective_from,
    createdBy: row.created_by,
    reason: row.reason,
  };
}

export function toCommissionLedger(row: CommissionLedgerRow): CommissionLedgerRecord {
  return {
    id: row.id,
    periodId: row.period_id,
    shopId: row.shop_id,
    grossStakes: row.gross_stakes,
    grossPayouts: row.gross_payouts,
    grossOperatorResult: row.gross_operator_result,
    shopSharePercent: row.shop_share_percent,
    shopShareAmount: row.shop_share_amount,
    platformSharePercent: row.platform_share_percent,
    platformShareAmount: row.platform_share_amount,
    createdAt: row.created_at,
  };
}

async function lockConfig(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${CONFIG_LOCK_KEY}))::text AS locked`;
}

async function latest(
  tx: Prisma.TransactionClient,
  shopId: string | null,
): Promise<CommissionConfigRecord | undefined> {
  const rows =
    shopId === null
      ? await tx.$queryRaw<ConfigRow[]>`
          SELECT ${CONFIG_COLUMNS} FROM settlement.commission_config
          WHERE shop_id IS NULL AND effective_from <= now()
          ORDER BY effective_from DESC, id DESC LIMIT 1`
      : await tx.$queryRaw<ConfigRow[]>`
          SELECT ${CONFIG_COLUMNS} FROM settlement.commission_config
          WHERE shop_id = ${shopId}::uuid AND effective_from <= now()
          ORDER BY effective_from DESC, id DESC LIMIT 1`;

  const row = rows[0];

  return row === undefined ? undefined : toConfig(row);
}

export function createCommissionRepository(prisma: PrismaClient): CommissionRepository {
  return {
    seedDefault: async (shopShareBasisPoints) =>
      prisma.$transaction(async (tx) => {
        await lockConfig(tx);

        const inserted = await tx.$executeRaw`
          INSERT INTO settlement.commission_config (shop_id, shop_share_percent, created_by, reason)
          SELECT NULL, ${basisPointsToPercentText(shopShareBasisPoints)}::numeric(5,2), 'system',
                 'Initial platform default from DEFAULT_SHOP_SHARE_PERCENT'
          WHERE NOT EXISTS (SELECT 1 FROM settlement.commission_config WHERE shop_id IS NULL)`;

        return inserted > 0;
      }),

    current: async () => {
      const rows = await prisma.$queryRaw<ConfigRow[]>`
        SELECT DISTINCT ON (shop_id) ${CONFIG_COLUMNS}
        FROM settlement.commission_config
        WHERE effective_from <= now()
        ORDER BY shop_id, effective_from DESC, id DESC`;

      const configs = rows.map(toConfig);

      return {
        platformDefault: configs.find((config) => config.shopId === null),
        shops: configs.filter((config) => config.shopId !== null),
      };
    },

    append: async (config, confirm) =>
      prisma.$transaction(async (tx) => {
        await lockConfig(tx);

        const before = await latest(tx, config.shopId);

        const inserted = await tx.$queryRaw<ConfigRow[]>`
          INSERT INTO settlement.commission_config (shop_id, shop_share_percent, created_by, reason)
          VALUES (${config.shopId}::uuid,
                  ${basisPointsToPercentText(config.shopShareBasisPoints)}::numeric(5,2),
                  ${config.createdBy}, ${config.reason})
          RETURNING ${CONFIG_COLUMNS}`;

        const row = inserted[0];

        if (row === undefined) {
          throw new Error("The commission configuration was not written.");
        }

        const change = { before, after: toConfig(row) };

        await confirm(change);

        return change;
      }),

    listLedger: async (filter) => {
      const rows = await prisma.$queryRaw<CommissionLedgerRow[]>`
        SELECT id, period_id, shop_id, gross_stakes, gross_payouts, gross_operator_result,
               shop_share_percent::text AS shop_share_percent, shop_share_amount,
               platform_share_percent::text AS platform_share_percent, platform_share_amount, created_at
        FROM settlement.commission_ledger
        WHERE ${filter.periodId === undefined ? sql`TRUE` : sql`period_id = ${filter.periodId}`}
        ORDER BY created_at DESC, shop_id
        LIMIT ${filter.limit}`;

      return rows.map(toCommissionLedger);
    },
  };
}
