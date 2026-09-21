import type { MatchEventType, MatchSide } from "@betng/contracts";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { SimulationEventRow, SimulationReader, SimulationResultRow } from "../interfaces/index.js";
import { orWhenTableMissing } from "./crossSchema.reader.js";

interface EventColumns {
  readonly id: string;
  readonly match_id: string;
  readonly sequence: number;
  readonly minute: number;
  readonly type: string;
  readonly side: string | null;
  readonly player: string | null;
  readonly secondary_player: string | null;
  readonly score_home: number;
  readonly score_away: number;
  readonly description: string;
}

function toEvent(row: EventColumns): SimulationEventRow {
  return {
    id: row.id,
    matchId: row.match_id,
    sequence: row.sequence,
    minute: row.minute,
    type: row.type as MatchEventType,
    side: row.side as MatchSide | null,
    player: row.player,
    secondaryPlayer: row.secondary_player,
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    description: row.description,
  };
}

export function createSimulationReader(prisma: PrismaClient): SimulationReader {
  return {
    hasResult: async (matchId) =>
      orWhenTableMissing(async () => {
        const rows = await prisma.$queryRaw<{ found: number }[]>`SELECT 1 AS found FROM simulation.match_results WHERE match_id = ${matchId}::uuid LIMIT 1`;

        return rows.length > 0;
      }, false),

    findResult: async (matchId) =>
      orWhenTableMissing<SimulationResultRow | undefined>(async () => {
        const rows = await prisma.$queryRaw<{ match_id: string; home_goals: number; away_goals: number; stats: unknown }[]>`SELECT match_id::text AS match_id, home_goals::int AS home_goals, away_goals::int AS away_goals, stats
                     FROM simulation.match_results WHERE match_id = ${matchId}::uuid LIMIT 1`;
        const row = rows[0];

        return row === undefined
          ? undefined
          : { matchId: row.match_id, homeGoals: row.home_goals, awayGoals: row.away_goals, stats: row.stats };
      }, undefined),

    listEvents: async (matchId, range) =>
      orWhenTableMissing(async () => {
        const upTo = range.upTo ?? 2_147_483_647;
        const rows = await prisma.$queryRaw<EventColumns[]>`SELECT id::text AS id, match_id::text AS match_id, sequence::int AS sequence, minute::int AS minute,
                            type::text AS type, side::text AS side, player, secondary_player,
                            score_home::int AS score_home, score_away::int AS score_away, description
                     FROM simulation.match_events
                     WHERE match_id = ${matchId}::uuid AND sequence > ${range.after} AND sequence <= ${upTo}
                     ORDER BY sequence ASC
                     LIMIT ${range.limit}`;

        return rows.map(toEvent);
      }, []),

    countEventsAfter: async (matchId, sequence) =>
      orWhenTableMissing(async () => {
        const rows = await prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM simulation.match_events
                     WHERE match_id = ${matchId}::uuid AND sequence > ${sequence}`;

        return rows[0]?.total ?? 0;
      }, 0),

    listScorers: async (leagueId, season, limit) =>
      orWhenTableMissing(async () => {
        // `e.sequence <= m.revealed_sequence` is the secrecy rule: a goal counts once it has been shown.
        const rows = await prisma.$queryRaw<{ player: string; team_id: string; goals: number; assists: number }[]>`WITH revealed AS (
                       SELECT e.player, e.secondary_player,
                              CASE WHEN e.side::text = 'HOME' THEN f.home_team_id ELSE f.away_team_id END AS team_id
                       FROM simulation.match_events e
                       JOIN "match"."matches" m ON m.id = e.match_id
                       JOIN "match"."fixtures" f ON f.id = m.fixture_id
                       WHERE f.league_id = ${leagueId}::uuid AND f.season = ${season}
                         AND m.status::text IN ('IN_PLAY', 'COMPLETED')
                         AND e.type::text = 'GOAL' AND e.side IS NOT NULL
                         AND e.sequence <= m.revealed_sequence
                     ), credits AS (
                       SELECT player, team_id, 1 AS goals, 0 AS assists FROM revealed WHERE player IS NOT NULL
                       UNION ALL
                       SELECT secondary_player, team_id, 0, 1 FROM revealed WHERE secondary_player IS NOT NULL
                     )
                     SELECT player, team_id::text AS team_id, sum(goals)::int AS goals, sum(assists)::int AS assists
                     FROM credits
                     GROUP BY player, team_id
                     HAVING sum(goals) > 0
                     ORDER BY goals DESC, assists DESC, player ASC
                     LIMIT ${limit}`;

        return rows.map((row) => ({ player: row.player, teamId: row.team_id, goals: row.goals, assists: row.assists }));
      }, []),

    matchesWithResult: async (matchIds) => {
      if (matchIds.length === 0) return [];

      return orWhenTableMissing(async () => {
        const rows = await prisma.$queryRaw<{ match_id: string }[]>`SELECT match_id::text AS match_id FROM simulation.match_results WHERE match_id = ANY(${[...matchIds]}::uuid[])`;

        return rows.map((row) => row.match_id);
      }, []);
    },
  };
}
