import { CommandHandler } from "@zudojs/cqrs";
import { asId } from "@betng/contracts";
import type { Bet } from "@betng/contracts";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import type { BetRepository } from "../../../../interfaces/index.js";
import {
  calculatePotentialPayout,
  calculateTotalOdds,
} from "../../../../utils/index.js";
import type { PlaceBetCommand } from "./placeBet.command.js";

/**
 * Accepts a bet slip.
 *
 * What this phase implements is acceptance: the payload is validated, the
 * slip is priced from the odds the client was shown, and it is recorded as
 * `PENDING`.
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

  private readonly now: () => Date;

  public constructor(bets: BetRepository, now: () => Date = () => new Date()) {
    super();
    this.bets = bets;
    this.now = now;
  }

  public async execute(command: PlaceBetCommand): Promise<Bet> {
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

    return this.bets.create(bet);
  }
}
