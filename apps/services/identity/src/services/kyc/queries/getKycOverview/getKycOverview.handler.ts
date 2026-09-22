import { QueryHandler } from "@zudojs/cqrs";
import type { KycOverview } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { loadKycOverview } from "../../kycOverview.helper.js";
import type { GetKycOverviewQuery } from "./getKycOverview.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class GetKycOverviewHandler extends QueryHandler<GetKycOverviewQuery, KycOverview> {
  public readonly queryType = IDENTITY_QUERY.GET_KYC_OVERVIEW;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetKycOverviewQuery): Promise<KycOverview> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);

    return (await loadKycOverview(store, customer.id)).overview;
  }
}
