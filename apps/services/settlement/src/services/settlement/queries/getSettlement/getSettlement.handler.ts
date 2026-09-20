import { QueryHandler } from "@zudojs/cqrs";
import type { Settlement } from "@betng/contracts";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import { SettlementNotFoundError } from "../../../../errors/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { GetSettlementQuery } from "./getSettlement.query.js";

/**
 * Reads one bet's settlement.
 *
 * A pending bet has no settlement, so this raises rather than inventing a
 * zero payout that a client could mistake for a loss.
 */
export class GetSettlementHandler extends QueryHandler<
  GetSettlementQuery,
  Settlement
> {
  public readonly queryType = SETTLEMENT_QUERY.GET_SETTLEMENT;

  private readonly settlements: SettlementRepository;

  public constructor(settlements: SettlementRepository) {
    super();
    this.settlements = settlements;
  }

  public async execute(query: GetSettlementQuery): Promise<Settlement> {
    const found = await this.settlements.findByBet(query.betId);

    if (found === undefined) {
      throw new SettlementNotFoundError(query.betId);
    }

    return found;
  }
}
