import { QueryHandler } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { KycStatusDto } from "../../../../dtos/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { loadKycOverview } from "../../kycOverview.helper.js";
import type { GetKycStatusQuery } from "./getKycStatus.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

/** `kyc.status` for wallet: the tier and the daily allowances it unlocks. */
export class GetKycStatusHandler extends QueryHandler<GetKycStatusQuery, KycStatusDto> {
  public readonly queryType = IDENTITY_QUERY.GET_KYC_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetKycStatusQuery): Promise<KycStatusDto> {
    const { store } = this.deps;

    if ((await store.customers.findById(query.customerId)) === undefined) {
      throw new ResourceNotFoundError("No customer has that id.");
    }

    const { overview } = await loadKycOverview(store, query.customerId);

    return {
      status: overview.status,
      tier: overview.tier,
      ...(overview.limits?.dailyDeposit === undefined ? {} : { dailyDeposit: overview.limits.dailyDeposit }),
      ...(overview.limits?.dailyWithdrawal === undefined ? {} : { dailyWithdrawal: overview.limits.dailyWithdrawal }),
    };
  }
}
