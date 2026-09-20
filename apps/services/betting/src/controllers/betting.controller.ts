/**
 * Betting HTTP handlers.
 *
 * A controller validates what arrived, dispatches one command or query on
 * the bus, and returns the value. No data access and no domain rules live
 * here.
 */

import {
  getRequestId,
  parseBody,
  parseQuery,
  requireParam,
} from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { Bet } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { PlaceBetCommand } from "../services/betting/commands/index.js";
import type { BetListDto } from "../dtos/index.js";
import { GetBetQuery, ListBetsQuery } from "../services/betting/queries/index.js";
import {
  listBetsQueryValidator,
  placeBetValidator,
} from "../validators/index.js";

/** The handlers the betting routes bind to. */
export interface BettingController {
  placeBet(context: HttpRouterContext): Promise<Bet>;
  getBet(context: HttpRouterContext): Promise<Bet>;
  listBets(context: HttpRouterContext): Promise<BetListDto>;
}

/** What the betting controller dispatches through. */
export interface BettingControllerOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

/**
 * Creates the betting controller.
 *
 * @param options - The buses the handlers are registered on.
 * @returns Handlers ready to bind to routes.
 */
export function createBettingController(
  options: BettingControllerOptions,
): BettingController {
  const { commandBus, queryBus } = options;

  return {
    placeBet: async (context) => {
      const request = parseBody(context.request, placeBetValidator);

      return commandBus.execute<PlaceBetCommand, Bet>(
        new PlaceBetCommand({
          userId: request.userId,
          selections: request.selections,
          stake: request.stake,
          currency: request.currency,
          requestId: getRequestId(context.request),
        }),
      );
    },

    getBet: async (context) =>
      queryBus.execute<GetBetQuery, Bet>(
        new GetBetQuery(requireParam(context.params, "id")),
      ),

    listBets: async (context) => {
      const query = parseQuery(context.query, listBetsQueryValidator);

      return {
        items: await queryBus.execute<ListBetsQuery, readonly Bet[]>(
          new ListBetsQuery({
            ...(query.userId === undefined ? {} : { userId: query.userId }),
            ...(query.status === undefined ? {} : { status: query.status }),
          }),
        ),
      };
    },
  };
}
