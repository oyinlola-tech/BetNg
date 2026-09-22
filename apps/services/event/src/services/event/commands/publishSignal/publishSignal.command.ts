import { Command } from "@zudojs/cqrs";
import { EVENT_COMMAND } from "../../../../constants/index.js";

export type SignalType = "BET_UPDATED" | "WALLET_UPDATED" | "NOTIFICATION_CREATED" | "SYSTEM_STATUS_UPDATED";

// A signal carries no state: subscribers re-read the account over REST.
export class PublishSignalCommand extends Command<"event.publishSignal"> {
  public readonly channel: string;

  public readonly signal: SignalType;

  public constructor(payload: { readonly channel: string; readonly type: SignalType }) {
    super(EVENT_COMMAND.PUBLISH_SIGNAL);
    this.channel = payload.channel;
    this.signal = payload.type;
  }
}
