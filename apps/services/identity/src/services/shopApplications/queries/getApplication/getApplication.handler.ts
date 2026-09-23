import { QueryHandler } from "@zudojs/cqrs";
import type { AdminShopApplication } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { toAdminShopApplication } from "../../applicationView.js";
import type { GetShopApplicationQuery } from "./getApplication.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class GetShopApplicationHandler extends QueryHandler<GetShopApplicationQuery, AdminShopApplication> {
  public readonly queryType = IDENTITY_QUERY.GET_SHOP_APPLICATION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetShopApplicationQuery): Promise<AdminShopApplication> {
    const { store } = this.deps;
    const application = await store.shopApplications.findById(query.applicationId);

    if (application === undefined) {
      throw new ResourceNotFoundError("That application does not exist.");
    }

    return toAdminShopApplication(application, await store.shopApplications.listDocuments(application.id));
  }
}
