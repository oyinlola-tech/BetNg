import { QueryHandler } from "@zudojs/cqrs";
import type { AdminShopSummary } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { summariseShop } from "../../shopSummary.helper.js";
import type { GetShopQuery } from "./getShop.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel">;

export class GetShopHandler extends QueryHandler<GetShopQuery, AdminShopSummary> {
  public readonly queryType = IDENTITY_QUERY.GET_SHOP;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetShopQuery): Promise<AdminShopSummary> {
    const shop = await this.deps.store.shops.findById(query.shopId);

    if (shop === undefined) {
      throw new ResourceNotFoundError("That shop does not exist.");
    }

    return summariseShop(this.deps, shop);
  }
}
