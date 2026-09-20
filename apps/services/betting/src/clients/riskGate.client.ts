/**
 * The risk gate, backed by an RPC call to the risk service.
 *
 * Risk is consulted *before* a slip is accepted, because that is the only
 * point at which the platform may act on its exposure. Once betting closes
 * the simulation runs, and nothing downstream of it may be influenced by
 * what was staked.
 *
 * The gate degrades open, and says so. While the risk model is unbuilt the
 * service answers `NOT_IMPLEMENTED`; the slip is accepted and the decision
 * is recorded as unassessed, so no log or caller can mistake "we accepted
 * it" for "risk approved it". A risk service that is *down*, as opposed to
 * unbuilt, is treated the same way and logged as a warning: refusing every
 * bet because an advisory service is unreachable would be a worse failure
 * than accepting one unassessed.
 */

import type { BetSelection } from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import { isRPCError } from "@zudojs/rpc";
import type { RiskGate } from "../interfaces/index.js";
import type { ExposureRequest, RiskClient } from "./risk.client.js";

const NOT_IMPLEMENTED = "NOT_IMPLEMENTED";

/**
 * Builds the exposure question from a slip.
 *
 * One slip contributes its stake to every leg it backs, and would owe its
 * full payout if all of them won. Aggregating across open slips is the risk
 * service's job, not betting's.
 */
function toExposureRequest(
  selections: readonly BetSelection[],
  stake: number,
): ExposureRequest | undefined {
  const first = selections[0];

  if (first === undefined) return undefined;

  return {
    matchId: first.matchId,
    marketId: first.marketId,
    selections: selections.map((leg) => ({
      selectionId: leg.selectionId,
      stake,
      liability: Math.floor(stake * leg.odds),
    })),
    currency: "NGN",
  };
}

export function createRpcRiskGate(risk: RiskClient, logger: Logger): RiskGate {
  return {
    evaluate: async (selections, stake, requestId) => {
      const request = toExposureRequest(selections, stake);

      if (request === undefined) {
        return {
          accepted: false,
          reason: "A slip must carry at least one selection.",
          assessed: false,
        };
      }

      try {
        const report = await risk.calculateExposure(request, requestId);

        if (report.action === "SUSPEND_MARKET") {
          return {
            accepted: false,
            reason:
              "This market is not accepting bets: its exposure is above " +
              "the limit.",
            assessed: true,
          };
        }

        return {
          accepted: true,
          reason: `Risk returned ${report.action}.`,
          assessed: true,
        };
      } catch (error) {
        const code = isRPCError(error) ? String(error.code) : "RPC_ERROR";

        if (code === NOT_IMPLEMENTED) {
          logger.debug("Risk model is not built; slip accepted unassessed", {
            requestId,
          });
        } else {
          logger.warn("Risk could not be consulted; slip accepted unassessed", {
            requestId,
            code,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return {
          accepted: true,
          reason: "Risk did not assess this slip.",
          assessed: false,
        };
      }
    },
  };
}
