import { QueryHandler } from "@zudojs/cqrs";
import type { ShopApplicationStatusView } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import { toShopApplicationStatusView } from "../../applicationView.js";
import type { GetShopApplicationStatusQuery } from "./getApplicationStatus.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

/**
 * Public. The reference alone is not enough: the address must match too, and a mismatch is reported the
 * same way as an unknown reference, so neither can be used to discover the other.
 */
export class GetShopApplicationStatusHandler extends QueryHandler<
  GetShopApplicationStatusQuery,
  ShopApplicationStatusView
> {
  public readonly queryType = IDENTITY_QUERY.GET_SHOP_APPLICATION_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetShopApplicationStatusQuery): Promise<ShopApplicationStatusView> {
    const application = await this.deps.store.shopApplications.findByReference(query.reference);

    if (application === undefined || application.applicantEmail !== normaliseEmail(query.applicantEmail)) {
      throw new ResourceNotFoundError("No application matches that reference and address.");
    }

    return toShopApplicationStatusView(application);
  }
}
