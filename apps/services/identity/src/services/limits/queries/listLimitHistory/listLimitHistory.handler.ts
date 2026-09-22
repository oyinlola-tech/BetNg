import { QueryHandler } from "@zudojs/cqrs";
import type { LimitHistoryEntry } from "@betng/contracts";
import { IDENTITY_QUERY, RESPONSIBLE_GAMING } from "../../../../constants/index.js";
import { toLimitHistoryEntry } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { ListLimitHistoryQuery } from "./listLimitHistory.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class ListLimitHistoryHandler extends QueryHandler<ListLimitHistoryQuery, readonly LimitHistoryEntry[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_LIMIT_HISTORY;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListLimitHistoryQuery): Promise<readonly LimitHistoryEntry[]> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);

    return (await store.limits.history(customer.id, RESPONSIBLE_GAMING.HISTORY_LIMIT)).map(toLimitHistoryEntry);
  }
}
