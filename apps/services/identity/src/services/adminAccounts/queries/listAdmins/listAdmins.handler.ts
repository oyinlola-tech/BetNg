import { QueryHandler } from "@zudojs/cqrs";
import type { AdminUserSummary } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import { toAdminUserSummary } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListAdminsQuery } from "./listAdmins.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class ListAdminsHandler extends QueryHandler<ListAdminsQuery, readonly AdminUserSummary[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_ADMINS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(): Promise<readonly AdminUserSummary[]> {
    // No secret, hash or sealed value crosses this boundary: `toAdminUserSummary` picks the columns.
    return (await this.deps.store.admins.list(LIST_LIMIT.ADMINS)).map(toAdminUserSummary);
  }
}
