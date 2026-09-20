/**
 * Betting HTTP handlers.
 *
 * What this phase implements is bet *acceptance*: validate the payload,
 * price the slip from the odds the client was shown, and record it as
 * `PENDING`.
 *
 * What it deliberately does not do yet is debit the wallet. Reserving a
 * stake across two services is a distributed-transaction problem — what
 * happens when the bet is written and the debit fails — and getting it wrong
 * is how a ledger ends up inconsistent. That design belongs in the phase
 * that builds it, not in a stub that appears to work.
 *
 * A bet is also never a route to influencing a result. The betting service
 * has no client for the simulation service and no way to reach it; see
 * `docs/architecture.md`.
 */

import { betting as bettingContracts } from "@betng/contracts";
import {
  notFound,
  parseBody,
  parseQuery,
  requireParam,
  type HttpRouterContext,
} from "@betng/service-kit";
import type { BetRepository } from "../repositories/betRepository.js";

export interface BetControllers {
  placeBet: (context: HttpRouterContext) => Promise<bettingContracts.Bet>;
  getBet: (context: HttpRouterContext) => Promise<bettingContracts.Bet>;
  listBets: (
    context: HttpRouterContext,
  ) => Promise<{ items: readonly bettingContracts.Bet[] }>;
}

/**
 * Multiplies the legs' odds into the slip's price.
 *
 * Rounded to two decimal places at the end rather than per leg, so a
 * five-leg accumulator does not accumulate five roundings.
 */
export function calculateTotalOdds(
  selections: readonly { readonly odds: number }[],
): number {
  const product = selections.reduce((total, leg) => total * leg.odds, 1);
  return Math.round(product * 100) / 100;
}

/**
 * The simulated payout a winning slip would return, in minor units.
 *
 * Floored: the platform never pays a fraction of a kobo, and rounding up
 * would mean paying out money that was never staked.
 */
export function calculatePotentialPayout(
  stake: number,
  totalOdds: number,
): number {
  return Math.floor(stake * totalOdds);
}

export function createBetControllers(
  repository: BetRepository,
  now: () => Date = () => new Date(),
): BetControllers {
  return {
    placeBet: async (context) => {
      const request = parseBody(
        context.request,
        bettingContracts.placeBetRequestSchema,
      );

      const totalOdds = calculateTotalOdds(request.selections);

      const bet = {
        id: crypto.randomUUID(),
        userId: request.userId,
        selections: request.selections,
        stake: request.stake,
        currency: request.currency,
        totalOdds,
        potentialPayout: calculatePotentialPayout(request.stake, totalOdds),
        status: "PENDING",
        placedAt: now().toISOString(),
      } as unknown as bettingContracts.Bet;

      return repository.create(bet);
    },

    getBet: async (context) => {
      const id = requireParam(context.params, "id");
      const bet = await repository.find(id);

      if (bet === undefined) {
        throw notFound(`No bet with id ${id}.`);
      }

      return bet;
    },

    listBets: async (context) => {
      const query = parseQuery(
        context.query,
        bettingContracts.listBetsQuerySchema,
      );

      return {
        items: await repository.list({
          ...(query.userId === undefined ? {} : { userId: query.userId }),
          ...(query.status === undefined ? {} : { status: query.status }),
        }),
      };
    },
  };
}
