import { QueryHandler } from "@zudojs/cqrs";
import type { AdminCashierSummary } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import { toAdminCashierSummary } from "../../../../dtos/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListShopCashiersQuery } from "./listShopCashiers.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel">;

export class ListShopCashiersHandler extends QueryHandler<
  ListShopCashiersQuery,
  readonly AdminCashierSummary[]
> {
  public readonly queryType = IDENTITY_QUERY.LIST_SHOP_CASHIERS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListShopCashiersQuery): Promise<readonly AdminCashierSummary[]> {
    const { store, readModel } = this.deps;

    if ((await store.shops.findById(query.shopId)) === undefined) {
      throw new ResourceNotFoundError("That shop does not exist.");
    }

    const rows = await store.cashiers.listByShop(query.shopId, LIST_LIMIT.CASHIERS);
    const figures = await readModel.cashierFigures(rows.map((row) => row.id));

    return rows.map((row) => toAdminCashierSummary(row, figures.get(row.id)));
  }
}
