import { Command } from "@zudojs/cqrs";
import { EVENT_COMMAND } from "../../../../constants/index.js";

export type SignalType =
  | "BET_UPDATED"
  | "BET_ACCEPTED"
  | "BET_SETTLED"
  | "WALLET_UPDATED"
  | "NOTIFICATION_CREATED"
  | "SYSTEM_STATUS_UPDATED"
  | "RISK_ALERT";

// A signal carries no state: subscribers re-read the account over REST.
export class PublishSignalCommand extends Command<"event.publishSignal"> {
  public readonly channel: string;

  public readonly signal: SignalType;

  /** Only an identifier hint for which record to re-read; never state. */
  public readonly hint: { readonly betId?: string } | undefined;

  public constructor(payload: {
    readonly channel: string;
    readonly type: SignalType;
    readonly payload?: { readonly betId?: string | undefined } | undefined;
  }) {
    super(EVENT_COMMAND.PUBLISH_SIGNAL);
    this.channel = payload.channel;
    this.signal = payload.type;
    this.hint = payload.payload?.betId === undefined ? undefined : { betId: payload.payload.betId };
  }
}
