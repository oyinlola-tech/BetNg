import { QueryHandler } from "@zudojs/cqrs";
import type { Cashier } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import { toCashier } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListOwnShopCashiersQuery } from "./listOwnShopCashiers.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class ListOwnShopCashiersHandler extends QueryHandler<ListOwnShopCashiersQuery, readonly Cashier[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_OWN_SHOP_CASHIERS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListOwnShopCashiersQuery): Promise<readonly Cashier[]> {
    const rows = await this.deps.store.cashiers.listByShop(query.shopId, LIST_LIMIT.CASHIERS);

    return rows.map(toCashier);
  }
}
