import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { BettingReader } from "../interfaces/index.js";
import { orWhenTableMissing } from "./crossSchema.reader.js";

/**
 * Reads whether a match has been bet on, and nothing else about the bets: the lifecycle only needs to know that
 * betting is active. No stake, bettor or selection is read here, and nothing read here reaches the simulation.
 */
export function createBettingReader(prisma: PrismaClient): BettingReader {
  return {
    matchesWithBets: async (matchIds) => {
      if (matchIds.length === 0) return [];

      const ids = Prisma.join(matchIds.map((id) => Prisma.sql`${id}::uuid`));

      return orWhenTableMissing(async () => {
        const rows = await prisma.$queryRaw<{ match_id: string }[]>(
          Prisma.sql`SELECT DISTINCT match_id::text AS match_id FROM betting.bet_selections WHERE match_id IN (${ids})`,
        );

        return rows.map((row) => row.match_id);
      }, []);
    },
  };
}
