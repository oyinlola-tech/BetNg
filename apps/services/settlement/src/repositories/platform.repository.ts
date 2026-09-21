/**
 * Cross-schema reads (`docs/architecture.md` §8). Read-only by construction: every statement is a SELECT,
 * and the service's login has no write grant outside `settlement`.
 *
 * Settlement reads bets here to settle them. It never produces, alters or infers a result: the score comes
 * from `simulation.match_results` alone.
 */

import type { PrismaClient } from "../databases/index.js";
import type { PlatformReader } from "../interfaces/index.js";
import type { BetChannel, BetLegRecord, BetRecord, MatchState } from "../models/index.js";

interface MatchRow {
  readonly id: string;
  readonly status: string;
  readonly lifecycle: string;
}

interface ResultRow {
  readonly home_goals: number;
  readonly away_goals: number;
}

interface BetRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly channel: string;
  readonly shop_id: string | null;
  readonly cashier_id: string | null;
  readonly stake: bigint;
  readonly status: string;
}

interface LegRow {
  readonly bet_id: string;
  readonly selection_id: string;
  readonly match_id: string;
  readonly market_type: string;
  readonly selection_code: string;
  readonly line: string | null;
  readonly odds: string;
  readonly match_status: string | null;
  readonly match_lifecycle: string | null;
  readonly home_goals: number | null;
  readonly away_goals: number | null;
  readonly match_settlement_kind: string | null;
}

interface ShopRow {
  readonly id: string;
  readonly name: string;
}

function toMatch(row: MatchRow): MatchState {
  return { id: row.id, status: row.status, lifecycle: row.lifecycle };
}

function toBet(row: BetRow): BetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel as BetChannel,
    shopId: row.shop_id,
    cashierId: row.cashier_id,
    stake: row.stake,
    status: row.status,
  };
}

function toLeg(row: LegRow): BetLegRecord {
  return {
    betId: row.bet_id,
    selectionId: row.selection_id,
    matchId: row.match_id,
    marketType: row.market_type,
    selectionCode: row.selection_code,
    line: row.line,
    odds: row.odds,
    matchStatus: row.match_status,
    matchLifecycle: row.match_lifecycle,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    matchSettlementKind: row.match_settlement_kind,
  };
}

export function createPlatformReader(prisma: PrismaClient): PlatformReader {
  return {
    findMatch: async (matchId) => {
      const rows = await prisma.$queryRaw<MatchRow[]>`
        SELECT id, status::text AS status, lifecycle::text AS lifecycle
        FROM match.matches WHERE id = ${matchId}::uuid`;

      const row = rows[0];

      return row === undefined ? undefined : toMatch(row);
    },

    findResult: async (matchId) => {
      const rows = await prisma.$queryRaw<ResultRow[]>`
        SELECT home_goals::int AS home_goals, away_goals::int AS away_goals
        FROM simulation.match_results WHERE match_id = ${matchId}::uuid`;

      const row = rows[0];

      return row === undefined
        ? undefined
        : { homeGoals: row.home_goals, awayGoals: row.away_goals };
    },

    listBetsOnMatch: async (matchId) => {
      const rows = await prisma.$queryRaw<BetRow[]>`
        SELECT b.id, b.user_id, b.channel::text AS channel, b.shop_id, b.cashier_id,
               b.stake::bigint AS stake, b.status::text AS status
        FROM betting.bets b
        WHERE b.status::text <> 'CANCELLED'
          AND EXISTS (
            SELECT 1 FROM betting.bet_selections bs
            WHERE bs.bet_id = b.id AND bs.match_id = ${matchId}::uuid)
        ORDER BY b.placed_at, b.id`;

      return rows.map(toBet);
    },

    listLegs: async (betIds) => {
      if (betIds.length === 0) {
        return [];
      }

      const rows = await prisma.$queryRaw<LegRow[]>`
        SELECT bs.bet_id, bs.selection_id, bs.match_id,
               bs.market_type::text AS market_type, bs.selection_code,
               bs.line::text AS line, bs.odds::text AS odds,
               m.status::text AS match_status, m.lifecycle::text AS match_lifecycle,
               r.home_goals::int AS home_goals, r.away_goals::int AS away_goals,
               ms.kind AS match_settlement_kind
        FROM betting.bet_selections bs
        LEFT JOIN match.matches m ON m.id = bs.match_id
        LEFT JOIN simulation.match_results r ON r.match_id = bs.match_id
        LEFT JOIN settlement.match_settlements ms ON ms.match_id = bs.match_id
        WHERE bs.bet_id = ANY(${[...betIds]}::uuid[])
        ORDER BY bs.bet_id, bs.kickoff_at, bs.id`;

      return rows.map(toLeg);
    },

    findShopNames: async (shopIds) => {
      if (shopIds.length === 0) {
        return new Map<string, string>();
      }

      const rows = await prisma.$queryRaw<ShopRow[]>`
        SELECT id, name FROM identity.shops WHERE id = ANY(${[...shopIds]}::uuid[])`;

      return new Map(rows.map((row) => [row.id, row.name]));
    },
  };
}
