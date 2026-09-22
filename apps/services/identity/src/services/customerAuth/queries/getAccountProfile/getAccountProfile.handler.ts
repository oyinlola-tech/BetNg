import { QueryHandler } from "@zudojs/cqrs";
import type { CustomerProfile } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { GetAccountProfileQuery } from "./getAccountProfile.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class GetAccountProfileHandler extends QueryHandler<GetAccountProfileQuery, CustomerProfile> {
  public readonly queryType = IDENTITY_QUERY.GET_ACCOUNT_PROFILE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetAccountProfileQuery): Promise<CustomerProfile> {
    const { customer } = await resolveCaller(this.deps.resolver, this.deps.store, query.caller);

    return toCustomerProfile(customer);
  }
}
