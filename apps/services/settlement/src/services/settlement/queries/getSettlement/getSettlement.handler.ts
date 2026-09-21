import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import { SettlementNotFoundError } from "../../../../errors/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { SettlementRecord } from "../../../../models/index.js";
import type { GetSettlementQuery } from "./getSettlement.query.js";

export class GetSettlementHandler extends QueryHandler<GetSettlementQuery, SettlementRecord> {
  public readonly queryType = SETTLEMENT_QUERY.GET_SETTLEMENT;

  private readonly settlements: SettlementRepository;

  public constructor(settlements: SettlementRepository) {
    super();
    this.settlements = settlements;
  }

  public async execute(query: GetSettlementQuery): Promise<SettlementRecord> {
    const found = await this.settlements.findByBet(query.betId, query.userId);

    if (found === undefined) {
      throw new SettlementNotFoundError(query.betId);
    }

    return found;
  }
}
