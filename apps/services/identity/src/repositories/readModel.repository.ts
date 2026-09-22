// Cross-schema reads of the §8 read model. "Today" is the UTC day. A table that does not exist yet yields zeros (logged once); any other failure propagates.

import type { Logger } from "@betng/service-kit";
import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  CashierFigures,
  CustomerFigures,
  DeletionBlockers,
  LossUsage,
  ReadModelRepository,
  ShopFigures,
  WindowUsage,
} from "../interfaces/index.js";

type Source = "wallet.wallet_accounts" | "wallet.payments" | "betting.bets" | "betting.tickets";

/** Payments that have left, or may still leave, the customer's control. */
const COUNTED_DEPOSIT_STATUSES = ["INITIATED", "PENDING", "PROCESSING", "CONFIRMED"];
const OPEN_PAYMENT_STATUSES = ["INITIATED", "PENDING", "PROCESSING"];

interface UsageRow {
  readonly used: bigint;
  readonly oldest: Date | null;
}

interface LossRow {
  readonly net: bigint;
  readonly open_stakes: bigint;
  readonly oldest: Date | null;
}

interface CountRow {
  readonly count: bigint;
}

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

  async function read<Row>(source: Source, query: () => Promise<Row[]>): Promise<readonly Row[]> {
    try {
      return await query();
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
    const rows = await read<BalanceRow>("wallet.wallet_accounts", async () => prisma.$queryRaw<BalanceRow[]>`
        SELECT owner_id::text AS id, balance::bigint AS balance
        FROM wallet.wallet_accounts
        WHERE owner_type::text = ${ownerType} AND owner_id = ANY(${[...ownerIds]}::uuid[])`,
    );

    return new Map(rows.map((row) => [row.id, Number(row.balance)]));
  };

  const depositUsage = async (customerId: string, since: Date): Promise<WindowUsage> => {
    const [row] = await read<UsageRow>("wallet.payments", async () => prisma.$queryRaw<UsageRow[]>`
        SELECT coalesce(sum(amount), 0)::bigint AS used, min(created_at) AS oldest
        FROM wallet.payments
        WHERE user_id = ${customerId}::uuid AND direction::text = 'DEPOSIT'
          AND status::text = ANY(${COUNTED_DEPOSIT_STATUSES}::text[]) AND created_at >= ${since}`,
    );

    return { used: row?.used ?? 0n, oldestAt: row?.oldest ?? undefined };
  };

  // Net loss of bets settled in the window (VOID refunds net to zero), plus stakes still open.
  const lossUsage = async (customerId: string, since: Date): Promise<LossUsage> => {
    const [row] = await read<LossRow>("betting.bets", async () => prisma.$queryRaw<LossRow[]>`
        SELECT (coalesce(sum(stake) FILTER (WHERE status::text IN ('WON', 'LOST') AND settled_at >= ${since}), 0)
              - coalesce(sum(payout) FILTER (WHERE status::text IN ('WON', 'LOST') AND settled_at >= ${since}), 0))::bigint AS net,
               coalesce(sum(stake) FILTER (WHERE status::text = 'PENDING'), 0)::bigint AS open_stakes,
               min(coalesce(settled_at, placed_at)) FILTER (WHERE coalesce(settled_at, placed_at) >= ${since}) AS oldest
        FROM betting.bets
        WHERE user_id = ${customerId}::uuid
          AND (status::text = 'PENDING' OR (status::text IN ('WON', 'LOST') AND settled_at >= ${since}))`,
    );

    const net = row?.net ?? 0n;

    return { used: net > 0n ? net : 0n, openStakes: row?.open_stakes ?? 0n, oldestAt: row?.oldest ?? undefined };
  };

  const deletionBlockers = async (customerId: string): Promise<DeletionBlockers> => {
    const [balances, payments, bets] = await Promise.all([
      read<{ balance: bigint }>("wallet.wallet_accounts", async () => prisma.$queryRaw<{ balance: bigint }[]>`
          SELECT balance::bigint AS balance FROM wallet.wallet_accounts
          WHERE owner_type::text = 'CUSTOMER' AND owner_id = ${customerId}::uuid`,
      ),
      read<CountRow>("wallet.payments", async () => prisma.$queryRaw<CountRow[]>`
          SELECT count(*)::bigint AS count FROM wallet.payments
          WHERE user_id = ${customerId}::uuid AND status::text = ANY(${OPEN_PAYMENT_STATUSES}::text[])`,
      ),
      read<CountRow>("betting.bets", async () => prisma.$queryRaw<CountRow[]>`
          SELECT count(*)::bigint AS count FROM betting.bets
          WHERE user_id = ${customerId}::uuid AND status::text = 'PENDING'`,
      ),
    ]);

    return {
      balance: balances[0]?.balance ?? 0n,
      openPayments: Number(payments[0]?.count ?? 0n),
      openBets: Number(bets[0]?.count ?? 0n),
    };
  };

  return {
    depositUsage,
    lossUsage,
    deletionBlockers,

    customerFigures: async (customerIds) => {
      if (customerIds.length === 0) {
        return new Map();
      }

      const [wallets, bets] = await Promise.all([
        balances("CUSTOMER", customerIds),
        read<CustomerBetRow>("betting.bets", async () => prisma.$queryRaw<CustomerBetRow[]>`
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
        read<ShopBetRow>("betting.bets", async () => prisma.$queryRaw<ShopBetRow[]>`
            SELECT shop_id::text AS id,
                   coalesce(sum(stake) FILTER (WHERE status::text <> 'CANCELLED'), 0)::bigint AS today_sales
            FROM betting.bets
            WHERE channel::text = 'SHOP' AND shop_id = ANY(${[...shopIds]}::uuid[]) AND placed_at >= ${dayStart}
            GROUP BY shop_id`,
        ),
        read<ShopTicketRow>("betting.tickets", async () => prisma.$queryRaw<ShopTicketRow[]>`
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
        read<CashierBetRow>("betting.bets", async () => prisma.$queryRaw<CashierBetRow[]>`
            SELECT cashier_id::text AS id,
                   count(*)::bigint AS sold,
                   coalesce(sum(stake) FILTER (WHERE status::text <> 'CANCELLED'), 0)::bigint AS today_sales
            FROM betting.bets
            WHERE channel::text = 'SHOP' AND cashier_id = ANY(${[...cashierIds]}::uuid[]) AND placed_at >= ${dayStart}
            GROUP BY cashier_id`,
        ),
        read<CashierPaidRow>("betting.tickets", async () => prisma.$queryRaw<CashierPaidRow[]>`
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
