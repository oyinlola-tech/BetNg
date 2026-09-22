import { QueryHandler } from "@zudojs/cqrs";
import type { AccountDeletion } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toAccountDeletion } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { deletionBlockers } from "../../accountSecurity.helper.js";
import type { GetAccountDeletionQuery } from "./getAccountDeletion.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "readModel">;

export class GetAccountDeletionHandler extends QueryHandler<GetAccountDeletionQuery, AccountDeletion> {
  public readonly queryType = IDENTITY_QUERY.GET_ACCOUNT_DELETION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetAccountDeletionQuery): Promise<AccountDeletion> {
    const { store, resolver, readModel } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);
    const latest = await store.deletions.findLatest(customer.id);
    const open = latest === undefined || latest.status === "PENDING" || latest.status === "CANCELLED";

    return toAccountDeletion(latest, open ? await deletionBlockers(readModel, customer.id) : []);
  }
}
