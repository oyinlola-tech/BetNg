import {
  createResponseContext,
  parseBody,
  parseQuery,
  requireParam,
} from "@betng/service-kit";
import type {
  HttpResponseContext,
  HttpRouterContext,
} from "@betng/service-kit";
import type { Bet } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import { PERMISSION } from "../constants/index.js";
import { toBetDto } from "../dtos/index.js";
import type { BetListDto } from "../dtos/index.js";
import {
  actorNotAllowed,
  betNotFound,
  invalidRequest,
} from "../errors/index.js";
import type { BetRecord } from "../interfaces/index.js";
import { PlaceBetCommand } from "../services/betting/commands/index.js";
import type { PlacementResult } from "../services/betting/commands/index.js";
import { GetBetQuery, ListBetsQuery } from "../services/betting/queries/index.js";
import {
  listBetsQueryValidator,
  placeBetValidator,
  uuidValidator,
} from "../validators/index.js";
import {
  assertLegCount,
  getRequestId,
  readIdempotencyKey,
  requireValidActor,
} from "./request.helper.js";

export interface BettingController {
  readonly placeBet: (context: HttpRouterContext) => Promise<HttpResponseContext>;
  readonly getBet: (context: HttpRouterContext) => Promise<Bet>;
  readonly listBets: (context: HttpRouterContext) => Promise<BetListDto>;
}

export interface BettingControllerOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function createBettingController(
  options: BettingControllerOptions,
): BettingController {
  const { commandBus, queryBus } = options;

  return {
    placeBet: async (context) => {
      /* Customers only: an admin is the operator, and the operator is never
       * a bettor. Any `userId` in the body is ignored. */
      const actor = requireValidActor(context.request, { kind: "CUSTOMER" });

      assertLegCount(context.request);

      const request = parseBody(context.request, placeBetValidator);

      const placed = await commandBus.execute<PlaceBetCommand, PlacementResult>(
        new PlaceBetCommand({
          channel: "ONLINE",
          actor,
          legs: request.selections.map((leg) => ({
            matchId: leg.matchId,
            marketId: leg.marketId,
            selectionId: leg.selectionId,
            odds: leg.odds,
          })),
          stake: request.stake,
          idempotencyKey: readIdempotencyKey(context.request),
          requestId: getRequestId(context.request),
        }),
      );

      return createResponseContext({
        status: placed.replayed ? 200 : 201,
      }).json(toBetDto(placed.bet));
    },

    getBet: async (context) => {
      const actor = requireValidActor(context.request, { kind: "CUSTOMER" });
      const betId = validate(uuidValidator, requireParam(context.params, "id"));

      if (!betId.success) {
        throw betNotFound();
      }

      return toBetDto(
        await queryBus.execute<GetBetQuery, BetRecord>(
          new GetBetQuery(betId.data, actor.id),
        ),
      );
    },

    listBets: async (context) => {
      const actor = requireValidActor(context.request, {
        kind: ["CUSTOMER", "ADMIN"],
      });
      const query = parseQuery(context.query, listBetsQueryValidator);

      let userId = actor.id;

      if (actor.kind === "ADMIN") {
        if (!actor.permissions.includes(PERMISSION.USERS_READ)) {
          throw actorNotAllowed("You do not have permission to do this.");
        }

        if (query.userId === undefined) {
          throw invalidRequest("Name the customer whose bets to list.");
        }

        userId = query.userId;
      }

      const bets = await queryBus.execute<ListBetsQuery, readonly BetRecord[]>(
        new ListBetsQuery({ userId, status: query.status, limit: query.limit }),
      );

      return { items: bets.map(toBetDto) };
    },
  };
}
