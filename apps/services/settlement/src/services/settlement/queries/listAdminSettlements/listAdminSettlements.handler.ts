import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { AdminSettlementRecord } from "../../../../models/index.js";
import type { ListAdminSettlementsQuery } from "./listAdminSettlements.query.js";

export class ListAdminSettlementsHandler extends QueryHandler<
  ListAdminSettlementsQuery,
  readonly AdminSettlementRecord[]
> {
  public readonly queryType = SETTLEMENT_QUERY.LIST_ADMIN_SETTLEMENTS;

  private readonly settlements: SettlementRepository;

  public constructor(settlements: SettlementRepository) {
    super();
    this.settlements = settlements;
  }

  public async execute(query: ListAdminSettlementsQuery): Promise<readonly AdminSettlementRecord[]> {
    return this.settlements.listAdmin(query.filter);
  }
}
