import { QueryHandler } from "@zudojs/cqrs";
import type { CustomerProfile } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { GetCustomerProfileQuery } from "./getCustomerProfile.query.js";

type Dependencies = Pick<HandlerDependencies, "resolver">;

/** `GET /auth/me`: the profile behind the bearer token, which must be a customer's. */
export class GetCustomerProfileHandler extends QueryHandler<GetCustomerProfileQuery, CustomerProfile> {
  public readonly queryType = IDENTITY_QUERY.GET_CUSTOMER_PROFILE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetCustomerProfileQuery): Promise<CustomerProfile> {
    const resolved = await this.deps.resolver.resolveAs(query.token, "CUSTOMER");

    return toCustomerProfile(resolved.customer);
  }
}
