import { QueryHandler } from "@zudojs/cqrs";
import type { AdminShopSummary } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { summariseShops } from "../../shopSummary.helper.js";
import type { ListShopsQuery } from "./listShops.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel">;

export class ListShopsHandler extends QueryHandler<ListShopsQuery, readonly AdminShopSummary[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_SHOPS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(): Promise<readonly AdminShopSummary[]> {
    return summariseShops(this.deps, await this.deps.store.shops.list(LIST_LIMIT.SHOPS));
  }
}
