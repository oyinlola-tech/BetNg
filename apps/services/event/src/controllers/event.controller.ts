import { ErrorCodes } from "@betng/contracts";
import { notFound, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import { matchChannel } from "@betng/contracts";
import type { ChannelState } from "../interfaces/index.js";
import { GetChannelStateQuery } from "../services/event/queries/index.js";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface EventController {
  getMatchChannel(context: HttpRouterContext): Promise<ChannelState>;
}

export function createEventController(queryBus: QueryBus): EventController {
  return {
    getMatchChannel: async (context) => {
      const matchId = requireParam(context.params, "matchId");

      if (!UUID.test(matchId)) {
        throw notFound("No such match channel.", { code: ErrorCodes.NOT_FOUND, expose: true });
      }

      return queryBus.execute<GetChannelStateQuery, ChannelState>(
        new GetChannelStateQuery(matchChannel(matchId)),
      );
    },
  };
}
