import { QueryHandler } from "@zudojs/cqrs";
import type { TwoFactorStatus } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { toTwoFactorStatus } from "../../accountSecurity.helper.js";
import type { GetTwoFactorStatusQuery } from "./getTwoFactorStatus.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class GetTwoFactorStatusHandler extends QueryHandler<GetTwoFactorStatusQuery, TwoFactorStatus> {
  public readonly queryType = IDENTITY_QUERY.GET_TWO_FACTOR_STATUS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetTwoFactorStatusQuery): Promise<TwoFactorStatus> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);
    const factor = await store.twoFactor.find(customer.id);

    return toTwoFactorStatus(factor, factor === undefined ? 0 : await store.twoFactor.countUnusedBackupCodes(customer.id));
  }
}
