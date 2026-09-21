import type { PrismaClient } from "../generated/prisma/client.js";
import type { BettingReader } from "../interfaces/index.js";
import { orWhenTableMissing } from "./crossSchema.reader.js";

/** Reads only whether a match has bets: no stake, bettor or selection, and nothing here reaches the simulation. */
export function createBettingReader(prisma: PrismaClient): BettingReader {
  return {
    matchesWithBets: async (matchIds) => {
      if (matchIds.length === 0) return [];

      return orWhenTableMissing(async () => {
        const rows = await prisma.$queryRaw<{ match_id: string }[]>`
          SELECT DISTINCT match_id::text AS match_id FROM betting.bet_selections
          WHERE match_id = ANY(${[...matchIds]}::uuid[])`;

        return rows.map((row) => row.match_id);
      }, []);
    },
  };
}
