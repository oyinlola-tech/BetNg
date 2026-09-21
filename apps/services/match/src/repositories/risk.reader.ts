import type { PrismaClient } from "../generated/prisma/client.js";
import type { RiskReader } from "../interfaces/index.js";

interface LimitColumns {
  readonly min_stake: string;
  readonly max_stake_per_bet: string;
}

export function createRiskReader(prisma: PrismaClient): RiskReader {
  return {
    activeStakeLimits: async () => {
      const rows = await prisma.$queryRaw<LimitColumns[]>`
        SELECT min_stake::text AS min_stake, max_stake_per_bet::text AS max_stake_per_bet
        FROM risk.risk_limits
        WHERE active
        ORDER BY version DESC
        LIMIT 1`;
      const row = rows[0];

      if (row === undefined) return undefined;

      const minStake = Number(row.min_stake);
      const maxStakePerBet = Number(row.max_stake_per_bet);
      const usable =
        Number.isSafeInteger(minStake) &&
        Number.isSafeInteger(maxStakePerBet) &&
        minStake >= 1 &&
        maxStakePerBet >= minStake;

      return usable ? { minStake, maxStakePerBet } : undefined;
    },
  };
}
