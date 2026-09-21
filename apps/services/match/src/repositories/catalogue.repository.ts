import type { PrismaClient } from "../generated/prisma/client.js";
import type { CatalogueRepository } from "../interfaces/index.js";

const UPDATE_TIMEOUT_MS = 10_000;

export function createCatalogueRepository(
  prisma: PrismaClient,
): CatalogueRepository {
  return {
    listLeagues: async () =>
      prisma.league.findMany({
        orderBy: [{ staggerSeconds: "asc" }, { name: "asc" }],
      }),

    findLeague: async (id) =>
      (await prisma.league.findUnique({ where: { id } })) ?? undefined,

    countLeagues: async () => prisma.league.count(),

    createLeague: async (league) => prisma.league.create({ data: league }),

    listTeams: async (leagueId) =>
      prisma.team.findMany({
        where: leagueId === undefined ? {} : { leagueId },
        include: { league: true },
        orderBy: [{ leagueId: "asc" }, { name: "asc" }],
      }),

    findTeam: async (id) =>
      (await prisma.team.findUnique({
        where: { id },
        include: { league: true },
      })) ?? undefined,

    createTeam: async (team) =>
      prisma.team.create({ data: team, include: { league: true } }),

    updateTeam: async (id, patch, afterUpdate) =>
      prisma.$transaction(
        async (tx) => {
          const before = await tx.team.findUnique({
            where: { id },
            include: { league: true },
          });

          if (before === null) return undefined;

          const after = await tx.team.update({
            where: { id },
            data: patch,
            include: { league: true },
          });

          await afterUpdate(before, after);

          return after;
        },
        { timeout: UPDATE_TIMEOUT_MS },
      ),
  };
}
