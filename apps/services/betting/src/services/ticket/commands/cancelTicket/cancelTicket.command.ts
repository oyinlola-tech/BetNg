import { Command } from "@zudojs/cqrs";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import type { CounterActor } from "../payoutTicket/index.js";

export class CancelTicketCommand extends Command<"betting.cancelTicket"> {
  public readonly code: string;

  public readonly reason: string;

  public readonly counter: CounterActor;

  public readonly requestId: string;

  public constructor(payload: {
    readonly code: string;
    readonly reason: string;
    readonly counter: CounterActor;
    readonly requestId: string;
  }) {
    super(BETTING_COMMAND.CANCEL_TICKET);
    this.code = payload.code;
    this.reason = payload.reason;
    this.counter = payload.counter;
    this.requestId = payload.requestId;
  }
}
