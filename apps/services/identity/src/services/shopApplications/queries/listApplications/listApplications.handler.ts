import { QueryHandler } from "@zudojs/cqrs";
import type { AdminShopApplication } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { toAdminShopApplication } from "../../applicationView.js";
import type { ListShopApplicationsQuery } from "./listApplications.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

/** The queue. Documents are left off here and fetched with one application, so a list stays cheap. */
export class ListShopApplicationsHandler extends QueryHandler<ListShopApplicationsQuery, readonly AdminShopApplication[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_SHOP_APPLICATIONS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListShopApplicationsQuery): Promise<readonly AdminShopApplication[]> {
    const rows = await this.deps.store.shopApplications.list(query.status, LIST_LIMIT.SHOP_APPLICATIONS);

    return rows.map((row) => toAdminShopApplication(row));
  }
}
