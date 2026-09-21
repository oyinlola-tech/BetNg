import { Command } from "@zudojs/cqrs";
import type { Actor } from "@betng/service-kit";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import type { BetChannel } from "../../../../interfaces/index.js";

/** A leg as the client submitted it. The odds are what it was shown, to be checked, never stored. */
export interface SubmittedLeg {
  readonly matchId: string;
  readonly marketId: string;
  readonly selectionId: string;
  readonly odds: number;
}

export interface PlaceBetPayload {
  readonly channel: BetChannel;
  /** The bettor (online) or the selling cashier (shop), from the gateway's headers. */
  readonly actor: Actor;
  readonly legs: readonly SubmittedLeg[];
  readonly stake: number;
  readonly idempotencyKey: string;
  readonly customerName?: string | undefined;
  readonly customerPhone?: string | undefined;
  readonly requestId: string;
}

export class PlaceBetCommand extends Command<"betting.placeBet"> {
  public readonly channel: BetChannel;

  public readonly actor: Actor;

  public readonly legs: readonly SubmittedLeg[];

  public readonly stake: number;

  public readonly idempotencyKey: string;

  public readonly customerName: string | undefined;

  public readonly customerPhone: string | undefined;

  public readonly requestId: string;

  public constructor(payload: PlaceBetPayload) {
    super(BETTING_COMMAND.PLACE_BET);
    this.channel = payload.channel;
    this.actor = payload.actor;
    this.legs = payload.legs;
    this.stake = payload.stake;
    this.idempotencyKey = payload.idempotencyKey;
    this.customerName = payload.customerName;
    this.customerPhone = payload.customerPhone;
    this.requestId = payload.requestId;
  }
}
