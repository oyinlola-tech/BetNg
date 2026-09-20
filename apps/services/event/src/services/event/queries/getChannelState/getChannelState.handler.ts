import { QueryHandler } from "@zudojs/cqrs";
import { EVENT_QUERY } from "../../../../constants/index.js";
import type {
  ChannelRegistry,
  ChannelState,
} from "../../../../interfaces/index.js";
import type { GetChannelStateQuery } from "./getChannelState.query.js";

/**
 * Reads a channel's current sequence and subscriber count.
 *
 * A client uses `lastSequence` to tell whether it is behind after a
 * reconnect, which is what makes resynchronisation cheap: it re-reads the
 * match over REST rather than asking for a replay the service does not keep.
 */
export class GetChannelStateHandler extends QueryHandler<
  GetChannelStateQuery,
  ChannelState
> {
  public readonly queryType = EVENT_QUERY.GET_CHANNEL_STATE;

  private readonly channels: ChannelRegistry;

  public constructor(channels: ChannelRegistry) {
    super();
    this.channels = channels;
  }

  public async execute(query: GetChannelStateQuery): Promise<ChannelState> {
    return this.channels.state(query.channel);
  }
}
