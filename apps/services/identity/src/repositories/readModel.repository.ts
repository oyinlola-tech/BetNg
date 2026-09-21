/**
 * Cross-schema reads of the wallet and betting services' tables.
 *
 * Column names and types are the shared read model in `docs/architecture.md`
 * §8. Every value is a bound parameter and every identifier is written out
 * here; nothing from a request reaches the SQL text.
 *
 * "Today" is the current UTC calendar day. Sales are the stakes of shop bets
 * placed today that were not cancelled; payouts are the payouts of tickets
 * paid today; a cashier's transactions are tickets sold plus tickets paid.
 *
 * A source table that does not exist yet (the owning service has not migrated)
 * contributes zeros and is logged once. Any other failure propagates.
 */

import type { Logger } from "@betng/service-kit";
import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  CashierFigures,
  CustomerFigures,
  ReadModelRepository,
  ShopFigures,
} from "../interfaces/index.js";

type Source = "wallet.wallet_accounts" | "betting.bets" | "betting.tickets";

const MISSING_RELATION_CODES: readonly string[] = ["42P01", "3F000"];

interface BalanceRow {
  readonly id: string;
  readonly balance: bigint;
}

interface CustomerBetRow {
  readonly id: string;
  readonly open_bets: bigint;
  readonly lifetime_stake: bigint;
  readonly lifetime_payout: bigint;
}

interface ShopBetRow {
  readonly id: string;
  readonly today_sales: bigint;
}

interface ShopTicketRow {
  readonly id: string;
  readonly open_tickets: bigint;
  readonly today_payouts: bigint;
}

interface CashierBetRow {
  readonly id: string;
  readonly sold: bigint;
  readonly today_sales: bigint;
}

interface CashierPaidRow {
  readonly id: string;
  readonly paid: bigint;
}

function originalCode(error: unknown): string | undefined {
  const meta = (error as { meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } } })
    .meta;
  const code = meta?.driverAdapterError?.cause?.originalCode ?? meta?.code;

  return typeof code === "string" ? code : undefined;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function createReadModelRepository(prisma: PrismaClient, logger: Logger): ReadModelRepository {
  const reportedMissing = new Set<Source>();

  async function read<Row>(source: Source, query: Prisma.Sql): Promise<readonly Row[]> {
    try {
      return await prisma.$queryRaw<Row[]>(query);
    } catch (error) {
      const code = originalCode(error);

      if (code === undefined || !MISSING_RELATION_CODES.includes(code)) {
        throw error;
      }

      if (!reportedMissing.has(source)) {
        reportedMissing.add(source);
        logger.warn("Read-model table does not exist yet; its figures are reported as zero", {
          event: "read_model_table_missing",
          table: source,
        });
      }

      return [];
    }
  }

  const balances = async (
    ownerType: "CUSTOMER" | "SHOP",
    ownerIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> => {
    const rows = await read<BalanceRow>(
      "wallet.wallet_accounts",
      Prisma.sql`
        SELECT owner_id::text AS id, balance::bigint AS balance
        FROM wallet.wallet_accounts
        WHERE owner_type::text = ${ownerType} AND owner_id = ANY(${[...ownerIds]}::uuid[])`,
    );

    return new Map(rows.map((row) => [row.id, Number(row.balance)]));
  };

  return {
    customerFigures: async (customerIds) => {
      if (customerIds.length === 0) {
        return new Map();
      }

      const [wallets, bets] = await Promise.all([
        balances("CUSTOMER", customerIds),
        read<CustomerBetRow>(
          "betting.bets",
          Prisma.sql`
            SELECT user_id::text AS id,
                   (count(*) FILTER (WHERE status::text = 'PENDING'))::bigint AS open_bets,
                   coalesce(sum(stake) FILTER (WHERE status::text IN ('PENDING', 'WON', 'LOST')), 0)::bigint AS lifetime_stake,
                   coalesce(sum(payout) FILTER (WHERE status::text = 'WON'), 0)::bigint AS lifetime_payout
            FROM betting.bets
            WHERE user_id = ANY(${[...customerIds]}::uuid[])
            GROUP BY user_id`,
        ),
      ]);

      const byCustomer = new Map(bets.map((row) => [row.id, row]));

      return new Map(
        customerIds.map((id): [string, CustomerFigures] => {
          const row = byCustomer.get(id);

          return [
            id,
            {
              balance: wallets.get(id) ?? 0,
              openBets: Number(row?.open_bets ?? 0n),
              lifetimeStake: Number(row?.lifetime_stake ?? 0n),
              lifetimePayout: Number(row?.lifetime_payout ?? 0n),
            },
          ];
        }),
      );
    },

    shopFigures: async (shopIds) => {
      if (shopIds.length === 0) {
        return new Map();
      }

      const dayStart = startOfUtcDay(new Date());

      const [floats, bets, tickets] = await Promise.all([
        balances("SHOP", shopIds),
        read<ShopBetRow>(
          "betting.bets",
          Prisma.sql`
            SELECT shop_id::text AS id,
                   coalesce(sum(stake) FILTER (WHERE status::text <> 'CANCELLED'), 0)::bigint AS today_sales
            FROM betting.bets
            WHERE channel::text = 'SHOP' AND shop_id = ANY(${[...shopIds]}::uuid[]) AND placed_at >= ${dayStart}
            GROUP BY shop_id`,
        ),
        read<ShopTicketRow>(
          "betting.tickets",
          Prisma.sql`
            SELECT t.shop_id::text AS id,
                   (count(*) FILTER (WHERE t.status::text = 'OPEN'))::bigint AS open_tickets,
                   coalesce(sum(b.payout) FILTER (WHERE t.paid_at >= ${dayStart}), 0)::bigint AS today_payouts
            FROM betting.tickets t
            JOIN betting.bets b ON b.id = t.bet_id
            WHERE t.shop_id = ANY(${[...shopIds]}::uuid[])
            GROUP BY t.shop_id`,
        ),
      ]);

      const salesByShop = new Map(bets.map((row) => [row.id, row]));
      const ticketsByShop = new Map(tickets.map((row) => [row.id, row]));

      return new Map(
        shopIds.map((id): [string, ShopFigures] => [
          id,
          {
            balance: floats.get(id) ?? 0,
            todaySales: Number(salesByShop.get(id)?.today_sales ?? 0n),
            todayPayouts: Number(ticketsByShop.get(id)?.today_payouts ?? 0n),
            openTickets: Number(ticketsByShop.get(id)?.open_tickets ?? 0n),
          },
        ]),
      );
    },

    cashierFigures: async (cashierIds) => {
      if (cashierIds.length === 0) {
        return new Map();
      }

      const dayStart = startOfUtcDay(new Date());

      const [sold, paid] = await Promise.all([
        read<CashierBetRow>(
          "betting.bets",
          Prisma.sql`
            SELECT cashier_id::text AS id,
                   count(*)::bigint AS sold,
                   coalesce(sum(stake) FILTER (WHERE status::text <> 'CANCELLED'), 0)::bigint AS today_sales
            FROM betting.bets
            WHERE channel::text = 'SHOP' AND cashier_id = ANY(${[...cashierIds]}::uuid[]) AND placed_at >= ${dayStart}
            GROUP BY cashier_id`,
        ),
        read<CashierPaidRow>(
          "betting.tickets",
          Prisma.sql`
            SELECT paid_by::text AS id, count(*)::bigint AS paid
            FROM betting.tickets
            WHERE paid_at >= ${dayStart} AND paid_by::text = ANY(${[...cashierIds]}::text[])
            GROUP BY paid_by`,
        ),
      ]);

      const soldByCashier = new Map(sold.map((row) => [row.id, row]));
      const paidByCashier = new Map(paid.map((row) => [row.id, row.paid]));

      return new Map(
        cashierIds.map((id): [string, CashierFigures] => [
          id,
          {
            todayTransactions:
              Number(soldByCashier.get(id)?.sold ?? 0n) + Number(paidByCashier.get(id) ?? 0n),
            todaySales: Number(soldByCashier.get(id)?.today_sales ?? 0n),
          },
        ]),
      );
    },

    shopBalance: async (shopId) => (await balances("SHOP", [shopId])).get(shopId) ?? 0,
  };
}
