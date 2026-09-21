import { randomUUID } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import type { PrismaClient } from "../generated/prisma/client.js";
import { deriveRatings } from "../utils/index.js";
import { LEAGUE_SEEDS } from "./catalogue.seed.js";

/** Serialises concurrent first starts; any constant unique to this service's seed will do. */
const SEED_ADVISORY_LOCK = 7_310_001;

export async function seedCatalogue(
  prisma: PrismaClient,
  logger: Logger,
): Promise<boolean> {
  const seeded = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SEED_ADVISORY_LOCK}::bigint)::text AS locked`;

    if ((await tx.league.count()) > 0) return false;

    for (const league of LEAGUE_SEEDS) {
      const leagueId = randomUUID();

      await tx.league.create({
        data: {
          id: leagueId,
          name: league.name,
          code: league.code,
          slug: league.slug,
          country: league.country,
          staggerSeconds: league.staggerSeconds,
        },
      });

      await tx.team.createMany({
        data: league.clubs.map((club) => ({
          id: randomUUID(),
          leagueId,
          name: club.name,
          shortName: club.shortName,
          code: club.code,
          city: club.city,
          stadium: club.stadium,
          colorPrimary: club.colorPrimary,
          colorSecondary: club.colorSecondary,
          ...deriveRatings(club.strength, club.code),
        })),
      });
    }

    return true;
  });

  if (seeded) {
    logger.info("Catalogue seeded", {
      leagues: LEAGUE_SEEDS.length,
      teams: LEAGUE_SEEDS.reduce(
        (total, league) => total + league.clubs.length,
        0,
      ),
    });
  }

  return seeded;
}
