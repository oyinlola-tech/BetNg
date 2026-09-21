/**
 * Cross-schema reads of the match, odds and identity tables.
 *
 * Every statement is a tagged template, so each value is a bound parameter;
 * the schema-qualified table names are literals in this file and nothing
 * from a request ever becomes SQL text.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  CounterStaff,
  LegSnapshot,
  MarketReader,
  MatchWindow,
} from "../interfaces/index.js";

export function createMarketReader(prisma: PrismaClient): MarketReader {
  return {
    loadLegs: async (selectionIds) =>
      prisma.$queryRaw<LegSnapshot[]>`
        SELECT
          selection.id::text              AS "selectionId",
          selection.market_id::text       AS "marketId",
          market.match_id::text           AS "marketMatchId",
          selection.match_id::text        AS "selectionMatchId",
          selection.code                  AS "selectionCode",
          selection.label                 AS "selectionLabel",
          selection.odds::text            AS "odds",
          market.type::text               AS "marketType",
          market.line::text               AS "line",
          market.status::text             AS "marketStatus",
          market.odds_version::int        AS "oddsVersion",
          game.lifecycle::text           AS "lifecycle",
          fixture.kickoff_at              AS "kickoffAt",
          fixture.betting_closes_at       AS "bettingClosesAt",
          fixture.league_id::text         AS "leagueId",
          league.name                     AS "leagueName",
          home.name                       AS "homeName",
          away.name                       AS "awayName"
        FROM odds.market_selections AS selection
        JOIN odds.markets   AS market  ON market.id = selection.market_id
        JOIN match.matches  AS game    ON game.id = market.match_id
        JOIN match.fixtures AS fixture ON fixture.id = game.fixture_id
        JOIN match.leagues  AS league  ON league.id = fixture.league_id
        JOIN match.teams    AS home    ON home.id = fixture.home_team_id
        JOIN match.teams    AS away    ON away.id = fixture.away_team_id
        WHERE selection.id = ANY(${[...selectionIds]}::uuid[])
      `,

    loadMatchWindows: async (matchIds) =>
      prisma.$queryRaw<MatchWindow[]>`
        SELECT
          game.id::text            AS "matchId",
          game.lifecycle::text     AS "lifecycle",
          fixture.betting_closes_at AS "bettingClosesAt"
        FROM match.matches  AS game
        JOIN match.fixtures AS fixture ON fixture.id = game.fixture_id
        WHERE game.id = ANY(${[...matchIds]}::uuid[])
      `,

    loadCounterStaff: async (cashierId, shopId) => {
      const rows = await prisma.$queryRaw<CounterStaff[]>`
        SELECT
          shop.code            AS "shopCode",
          shop.status::text    AS "shopStatus",
          cashier.display_name AS "cashierName",
          cashier.status::text AS "cashierStatus"
        FROM identity.cashiers AS cashier
        JOIN identity.shops    AS shop ON shop.id = cashier.shop_id
        WHERE cashier.id = ${cashierId}::uuid
          AND shop.id = ${shopId}::uuid
      `;

      return rows[0];
    },
  };
}
