import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { SettlementRecord } from "../../../../models/index.js";
import type { ListSettlementsQuery } from "./listSettlements.query.js";

export class ListSettlementsHandler extends QueryHandler<
  ListSettlementsQuery,
  readonly SettlementRecord[]
> {
  public readonly queryType = SETTLEMENT_QUERY.LIST_SETTLEMENTS;

  private readonly settlements: SettlementRepository;

  public constructor(settlements: SettlementRepository) {
    super();
    this.settlements = settlements;
  }

  public async execute(query: ListSettlementsQuery): Promise<readonly SettlementRecord[]> {
    return this.settlements.list(query.filter);
  }
}
