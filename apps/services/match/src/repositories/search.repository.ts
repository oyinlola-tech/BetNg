import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  LeagueHit,
  MatchHit,
  SearchRepository,
  TeamHit,
} from "../interfaces/index.js";

interface TeamColumns {
  readonly id: string;
  readonly name: string;
  readonly league_id: string;
  readonly league_name: string;
}

interface MatchColumns {
  readonly id: string;
  readonly home_name: string;
  readonly away_name: string;
  readonly league_id: string;
  readonly league_code: string;
  readonly matchday: number;
}

/** Every term reaches SQL as a bound parameter with `ESCAPE '\'`, so `%` and `_` in it match only themselves. */
export function createSearchRepository(prisma: PrismaClient): SearchRepository {
  return {
    leagues: async (term, limit) =>
      prisma.$queryRaw<LeagueHit[]>`
        SELECT id::text AS id, name, country
        FROM "match"."leagues"
        WHERE name ILIKE ${term.pattern} ESCAPE '\\' OR code ILIKE ${term.pattern} ESCAPE '\\'
        ORDER BY (name ILIKE ${term.prefix} ESCAPE '\\') DESC, name ASC, id ASC
        LIMIT ${limit}`,

    teams: async (term, limit) => {
      const rows = await prisma.$queryRaw<TeamColumns[]>`
        SELECT t.id::text AS id, t.name, t.league_id::text AS league_id, l.name AS league_name
        FROM "match"."teams" t
        JOIN "match"."leagues" l ON l.id = t.league_id
        WHERE t.name ILIKE ${term.pattern} ESCAPE '\\'
           OR t.short_name ILIKE ${term.pattern} ESCAPE '\\'
           OR t.code ILIKE ${term.pattern} ESCAPE '\\'
        ORDER BY (t.name ILIKE ${term.prefix} ESCAPE '\\') DESC, t.name ASC, t.id ASC
        LIMIT ${limit}`;

      return rows.map((row): TeamHit => ({
        id: row.id,
        name: row.name,
        leagueId: row.league_id,
        leagueName: row.league_name,
      }));
    },

    matches: async (term, window, limit) => {
      const rows = await prisma.$queryRaw<MatchColumns[]>`
        SELECT m.id::text AS id, h.name AS home_name, a.name AS away_name,
               f.league_id::text AS league_id, l.code AS league_code, f.matchday::int AS matchday
        FROM "match"."matches" m
        JOIN "match"."fixtures" f ON f.id = m.fixture_id
        JOIN "match"."teams" h ON h.id = f.home_team_id
        JOIN "match"."teams" a ON a.id = f.away_team_id
        JOIN "match"."leagues" l ON l.id = f.league_id
        WHERE f.kickoff_at BETWEEN ${window.from} AND ${window.to}
          AND m.status::text <> 'CANCELLED'
          AND (h.name ILIKE ${term.pattern} ESCAPE '\\' OR a.name ILIKE ${term.pattern} ESCAPE '\\'
            OR h.short_name ILIKE ${term.pattern} ESCAPE '\\' OR a.short_name ILIKE ${term.pattern} ESCAPE '\\')
        ORDER BY f.kickoff_at ASC, m.id ASC
        LIMIT ${limit}`;

      return rows.map((row): MatchHit => ({
        id: row.id,
        homeName: row.home_name,
        awayName: row.away_name,
        leagueId: row.league_id,
        leagueCode: row.league_code,
        matchday: row.matchday,
      }));
    },
  };
}
