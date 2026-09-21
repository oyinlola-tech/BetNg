import { Command } from "@zudojs/cqrs";
import { BETTING_COMMAND } from "../../../../constants/index.js";

export interface CounterActor {
  readonly cashierId: string;
  readonly role: string;
  readonly shopId: string;
}

export class PayoutTicketCommand extends Command<"betting.payoutTicket"> {
  public readonly code: string;

  // Forwarded to identity; never stored or logged.
  public readonly pin: string;

  public readonly counter: CounterActor;

  public readonly requestId: string;

  public constructor(payload: {
    readonly code: string;
    readonly pin: string;
    readonly counter: CounterActor;
    readonly requestId: string;
  }) {
    super(BETTING_COMMAND.PAYOUT_TICKET);
    this.code = payload.code;
    this.pin = payload.pin;
    this.counter = payload.counter;
    this.requestId = payload.requestId;
  }
}
