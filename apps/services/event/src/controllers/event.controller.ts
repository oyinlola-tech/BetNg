/**
 * The event service's REST handlers.
 *
 * Read-only, and deliberately so. A channel's state is useful to a client
 * deciding whether it is behind, and to an operator checking whether anyone
 * is listening. Publishing is not here: it arrives by RPC from inside the
 * platform, so no HTTP caller — gateway included — can inject a match event.
 */

import { requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import { matchChannel } from "@betng/contracts";
import type { ChannelState } from "../interfaces/index.js";
import { GetChannelStateQuery } from "../services/event/queries/index.js";

/** The handlers the event routes bind to. */
export interface EventController {
  getMatchChannel(context: HttpRouterContext): Promise<ChannelState>;
}

/**
 * Creates the event REST controller.
 *
 * @param queryBus - The bus the read handlers are registered on.
 * @returns Handlers ready to bind to routes.
 */
export function createEventController(queryBus: QueryBus): EventController {
  return {
    getMatchChannel: async (context) =>
      queryBus.execute<GetChannelStateQuery, ChannelState>(
        new GetChannelStateQuery(
          matchChannel(requireParam(context.params, "matchId")),
        ),
      ),
  };
}
