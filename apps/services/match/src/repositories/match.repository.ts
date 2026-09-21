import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { MATCH_INCLUDE } from "../interfaces/index.js";
import type { FixtureFilter, MatchRepository } from "../interfaces/index.js";

function fixtureWhere(filter: Omit<FixtureFilter, "limit">): Prisma.FixtureWhereInput {
  return {
    ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
    ...(filter.season === undefined ? {} : { season: filter.season }),
    ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
    ...(filter.from === undefined && filter.to === undefined
      ? {}
      : {
          kickoffAt: {
            ...(filter.from === undefined ? {} : { gte: filter.from }),
            ...(filter.to === undefined ? {} : { lte: filter.to }),
          },
        }),
  };
}

export function createMatchRepository(prisma: PrismaClient): MatchRepository {
  return {
    listFixtures: async (filter) =>
      prisma.fixture.findMany({
        where: fixtureWhere(filter),
        include: { match: true },
        orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
        take: filter.limit,
      }),

    listMatches: async (filter) =>
      prisma.match.findMany({
        where: {
          ...(filter.status === undefined ? {} : { status: filter.status }),
          fixture: fixtureWhere(filter),
        },
        include: MATCH_INCLUDE,
        orderBy: [{ fixture: { kickoffAt: filter.newestFirst === true ? "desc" : "asc" } }, { id: "asc" }],
        take: filter.limit,
      }),

    findMatch: async (id) => (await prisma.match.findUnique({ where: { id }, include: MATCH_INCLUDE })) ?? undefined,

    listTransitions: async (matchId) =>
      prisma.matchTransition.findMany({ where: { matchId }, orderBy: { sequence: "asc" }, take: 200 }),

    listCompleted: async (filter) =>
      prisma.match.findMany({
        where: {
          status: "COMPLETED",
          homeScore: { not: null },
          awayScore: { not: null },
          fixture: {
            ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
            ...(filter.season === undefined ? {} : { season: filter.season }),
          },
        },
        include: MATCH_INCLUDE,
        orderBy: [{ completedAt: "desc" }, { id: "asc" }],
        take: filter.limit,
      }),

    currentSeason: async (leagueId, now) => {
      const latest = await prisma.fixture.findFirst({
        where: { leagueId, kickoffAt: { lte: now } },
        orderBy: { kickoffAt: "desc" },
        select: { season: true },
      });

      if (latest !== null) return latest.season;

      const first = await prisma.fixture.findFirst({
        where: { leagueId },
        orderBy: { kickoffAt: "asc" },
        select: { season: true },
      });

      return first?.season ?? 1;
    },

    latestScheduledRound: async (leagueId) => {
      const latest = await prisma.fixture.findFirst({
        where: { leagueId, source: "SCHEDULER" },
        orderBy: [{ season: "desc" }, { matchday: "desc" }],
        select: { season: true, matchday: true, kickoffAt: true },
      });

      return latest ?? undefined;
    },

    countUpcomingRounds: async (leagueId, now) => {
      const rounds = await prisma.fixture.groupBy({
        by: ["season", "matchday"],
        where: { leagueId, source: "SCHEDULER", kickoffAt: { gt: now } },
      });

      return rounds.length;
    },

    createFixtures: async (fixtures, options) =>
      prisma.$transaction(async (tx) => {
        const rows = fixtures.map((fixture) => ({ ...fixture, id: randomUUID(), source: options.source, createdAt: options.at }));

        // A pairing an admin already added to this matchday is left as it is rather than failing the round.
        await tx.fixture.createMany({ data: rows, skipDuplicates: true });

        const inserted = await tx.fixture.findMany({
          where: { id: { in: rows.map((row) => row.id) } },
          select: { id: true },
        });

        const matches = inserted.map((fixture) => ({ id: randomUUID(), fixtureId: fixture.id }));

        await tx.match.createMany({
          data: matches.map((match) => ({
            ...match,
            status: "SCHEDULED" as const,
            lifecycle: "FIXTURE_CREATED",
            createdAt: options.at,
          })),
        });

        await tx.matchTransition.createMany({
          data: matches.map((match) => ({
            matchId: match.id,
            fromState: null,
            toState: "FIXTURE_CREATED",
            at: options.at,
            actor: options.actor,
          })),
        });

        return matches.map((match) => match.id);
      }),
  };
}
