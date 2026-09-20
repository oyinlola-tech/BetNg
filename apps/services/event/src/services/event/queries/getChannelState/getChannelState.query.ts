import { Query } from "@zudojs/cqrs";
import { EVENT_QUERY } from "../../../../constants/index.js";

/** Asks where a channel has got to, and how many are listening. */
export class GetChannelStateQuery extends Query<"event.getChannelState"> {
  public readonly channel: string;

  public constructor(channel: string) {
    super(EVENT_QUERY.GET_CHANNEL_STATE);
    this.channel = channel;
  }
}
