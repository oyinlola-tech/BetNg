import { CommandHandler } from "@zudojs/cqrs";
import type { EventBus } from "@zudojs/events";
import { asId } from "@betng/contracts";
import type { Bet } from "@betng/contracts";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import { BetPlacedEvent } from "../../../../events/index.js";
import type {
  BetRepository,
  RiskGate,
} from "../../../../interfaces/index.js";
import { MarketSuspendedError } from "../../../../errors/index.js";
import {
  calculatePotentialPayout,
  calculateTotalOdds,
} from "../../../../utils/index.js";
import type { PlaceBetCommand } from "./placeBet.command.js";

/**
 * Accepts a bet slip.
 *
 * The order here is the platform's central integrity rule in code. Risk is
 * consulted *before* the slip is accepted, because that is the only moment
 * the platform may act on its exposure: it can decline the bet or suspend
 * the market. Once betting closes the simulation runs, and nothing
 * downstream of it may be influenced by what was staked.
 *
 * What this phase implements is acceptance: risk is consulted, the payload
 * is validated, the slip is priced from the odds the client was shown, it is
 * recorded as `PENDING`, and a `betting.betPlaced` event is published.
 *
 * What it deliberately does not do yet is debit the wallet. Reserving a
 * stake across two services is a distributed-transaction problem — what
 * happens when the bet is written and the debit fails — and getting it
 * wrong is how a ledger ends up inconsistent. That design belongs in the
 * phase that builds it, not in a stub that appears to work.
 *
 * A bet is also never a route to influencing a result: this service holds
 * no client for the simulation service. See `docs/architecture.md`.
 */
export class PlaceBetHandler extends CommandHandler<PlaceBetCommand, Bet> {
  public readonly commandType = BETTING_COMMAND.PLACE_BET;

  private readonly bets: BetRepository;

  private readonly events: EventBus;

  private readonly risk: RiskGate;

  private readonly now: () => Date;

  public constructor(
    bets: BetRepository,
    events: EventBus,
    risk: RiskGate,
    now: () => Date = () => new Date(),
  ) {
    super();
    this.bets = bets;
    this.events = events;
    this.risk = risk;
    this.now = now;
  }

  public async execute(command: PlaceBetCommand): Promise<Bet> {
    const decision = await this.risk.evaluate(
      command.selections,
      command.stake,
      command.requestId,
    );

    if (!decision.accepted) {
      throw new MarketSuspendedError(decision.reason);
    }

    const totalOdds = calculateTotalOdds(command.selections);

    const bet: Bet = {
      id: asId<"BetId">(crypto.randomUUID()),
      userId: asId<"UserId">(command.userId),
      selections: command.selections,
      stake: command.stake,
      currency: command.currency,
      totalOdds,
      potentialPayout: calculatePotentialPayout(command.stake, totalOdds),
      status: "PENDING",
      placedAt: this.now().toISOString(),
    };

    const created = await this.bets.create(bet);

    await this.events.publish(
      BetPlacedEvent.create({
        betId: created.id,
        userId: created.userId,
        selections: created.selections,
        stake: created.stake,
        totalOdds: created.totalOdds,
        potentialPayout: created.potentialPayout,
        currency: created.currency,
      }),
    );

    return created;
  }
}
