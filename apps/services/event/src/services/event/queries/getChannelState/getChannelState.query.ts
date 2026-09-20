import { Query } from "@zudojs/cqrs";
import { EVENT_QUERY } from "../../../../constants/index.js";

export class GetChannelStateQuery extends Query<"event.getChannelState"> {
  public readonly channel: string;

  public constructor(channel: string) {
    super(EVENT_QUERY.GET_CHANNEL_STATE);
    this.channel = channel;
  }
}
