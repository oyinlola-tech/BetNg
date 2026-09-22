import { QueryHandler } from "@zudojs/cqrs";
import type { AccountSession } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toAccountSession } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { ListAccountSessionsQuery } from "./listAccountSessions.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class ListAccountSessionsHandler extends QueryHandler<ListAccountSessionsQuery, readonly AccountSession[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_ACCOUNT_SESSIONS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListAccountSessionsQuery): Promise<readonly AccountSession[]> {
    const { store, resolver } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, query.caller);

    return (await store.sessions.listLive(customer.id, new Date())).map((row) => toAccountSession(row, session?.id));
  }
}
