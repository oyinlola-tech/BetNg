import { QueryHandler } from "@zudojs/cqrs";
import type { Settlement } from "@betng/contracts";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { ListSettlementsQuery } from "./listSettlements.query.js";

export class ListSettlementsHandler extends QueryHandler<
  ListSettlementsQuery,
  readonly Settlement[]
> {
  public readonly queryType = SETTLEMENT_QUERY.LIST_SETTLEMENTS;

  private readonly settlements: SettlementRepository;

  public constructor(settlements: SettlementRepository) {
    super();
    this.settlements = settlements;
  }

  public async execute(): Promise<readonly Settlement[]> {
    return this.settlements.list();
  }
}
