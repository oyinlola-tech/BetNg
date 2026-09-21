import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { CommissionRepository } from "../../../../interfaces/index.js";
import type { CommissionConfigRecord } from "../../../../models/index.js";
import type { GetCommissionConfigQuery } from "./getCommissionConfig.query.js";

export interface CurrentCommissionConfig {
  readonly platformDefault: CommissionConfigRecord;
  readonly shops: readonly CommissionConfigRecord[];
}

export class GetCommissionConfigHandler extends QueryHandler<
  GetCommissionConfigQuery,
  CurrentCommissionConfig
> {
  public readonly queryType = SETTLEMENT_QUERY.GET_COMMISSION_CONFIG;

  private readonly commission: CommissionRepository;

  public constructor(commission: CommissionRepository) {
    super();
    this.commission = commission;
  }

  public async execute(): Promise<CurrentCommissionConfig> {
    const snapshot = await this.commission.current();

    if (snapshot.platformDefault === undefined) {
      throw new Error("The platform default commission configuration has not been seeded.");
    }

    return { platformDefault: snapshot.platformDefault, shops: snapshot.shops };
  }
}
