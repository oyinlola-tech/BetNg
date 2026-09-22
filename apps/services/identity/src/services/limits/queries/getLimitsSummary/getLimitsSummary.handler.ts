import { QueryHandler } from "@zudojs/cqrs";
import type { LimitsSummary } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { buildLimitsSummary } from "../../limits.helper.js";
import type { GetLimitsSummaryQuery } from "./getLimitsSummary.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "readModel">;

export class GetLimitsSummaryHandler extends QueryHandler<GetLimitsSummaryQuery, LimitsSummary> {
  public readonly queryType = IDENTITY_QUERY.GET_LIMITS_SUMMARY;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetLimitsSummaryQuery): Promise<LimitsSummary> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);

    return buildLimitsSummary(this.deps, store, customer);
  }
}
