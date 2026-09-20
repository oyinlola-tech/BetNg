import { Command } from "@zudojs/cqrs";
import type { BetSelection, Currency } from "@betng/contracts";
import { BETTING_COMMAND } from "../../../../constants/index.js";

/** Asks for a bet slip to be accepted. */
export class PlaceBetCommand extends Command<"betting.placeBet"> {
  public readonly userId: string;

  public readonly selections: readonly BetSelection[];

  /** Simulated stake in minor units. */
  public readonly stake: number;

  public readonly currency: Currency;

  /** The correlation identifier, carried across the hop to risk. */
  public readonly requestId: string;

  public constructor(payload: {
    readonly userId: string;
    readonly selections: readonly BetSelection[];
    readonly stake: number;
    readonly currency: Currency;
    readonly requestId: string;
  }) {
    super(BETTING_COMMAND.PLACE_BET);
    this.userId = payload.userId;
    this.selections = payload.selections;
    this.stake = payload.stake;
    this.currency = payload.currency;
    this.requestId = payload.requestId;
  }
}
