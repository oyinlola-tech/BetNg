import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { CommissionRepository, PlatformReader } from "../../../../interfaces/index.js";
import type { CommissionLedgerRecord } from "../../../../models/index.js";
import type { ListCommissionQuery } from "./listCommission.query.js";

export interface NamedCommission {
  readonly record: CommissionLedgerRecord;
  readonly shopName: string | undefined;
}

export class ListCommissionHandler extends QueryHandler<ListCommissionQuery, readonly NamedCommission[]> {
  public readonly queryType = SETTLEMENT_QUERY.LIST_COMMISSION;

  private readonly commission: CommissionRepository;
  private readonly platform: PlatformReader;

  public constructor(commission: CommissionRepository, platform: PlatformReader) {
    super();
    this.commission = commission;
    this.platform = platform;
  }

  public async execute(query: ListCommissionQuery): Promise<readonly NamedCommission[]> {
    const records = await this.commission.listLedger(query.filter);
    const names = await this.platform.findShopNames([...new Set(records.map((record) => record.shopId))]);

    return records.map((record) => ({ record, shopName: names.get(record.shopId) }));
  }
}
