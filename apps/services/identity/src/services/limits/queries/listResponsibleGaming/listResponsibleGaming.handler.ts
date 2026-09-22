import { QueryHandler } from "@zudojs/cqrs";
import type { Page, ResponsibleGamingAccount } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies, ResponsibleGamingRow } from "../../../../interfaces/index.js";
import { buildLimitsSummary } from "../../limits.helper.js";
import type { ListResponsibleGamingQuery } from "./listResponsibleGaming.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel">;

type Flag = ResponsibleGamingAccount["flags"][number];

function flagsOf(row: ResponsibleGamingRow): { readonly flags: Flag[]; readonly flaggedAt: Date | undefined } {
  const flags: Flag[] = [];
  const times: Date[] = [];

  if (row.selfExcluded) flags.push("SELF_EXCLUDED");

  for (const [flag, at] of [["LIMIT_BREACH_ATTEMPT", row.breachAt], ["LIMIT_RAISED", row.raisedAt], ["LONG_SESSION", row.longSessionAt]] as const) {
    if (at !== undefined) {
      flags.push(flag);
      times.push(at);
    }
  }

  const flaggedAt = times.reduce<Date | undefined>((latest, at) => (latest === undefined || at > latest ? at : latest), undefined);

  return { flags, flaggedAt };
}

/** Flags are derived from stored rows: an active self-exclusion, recent refused checks, recent loosenings, and long live sessions. */
export class ListResponsibleGamingHandler extends QueryHandler<ListResponsibleGamingQuery, Page<ResponsibleGamingAccount>> {
  public readonly queryType = IDENTITY_QUERY.LIST_RESPONSIBLE_GAMING;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListResponsibleGamingQuery): Promise<Page<ResponsibleGamingAccount>> {
    const { store } = this.deps;
    const { items, total } = await store.limits.page(query.filter);

    const accounts = await Promise.all(
      items.map(async (row): Promise<ResponsibleGamingAccount> => {
        const summary = await buildLimitsSummary(this.deps, store, row.customer, query.filter.now);
        const { flags, flaggedAt } = flagsOf(row);

        return {
          ...summary,
          limits: [...summary.limits],
          userId: row.customer.id,
          displayName: row.customer.displayName,
          email: row.customer.email,
          flags,
          ...(flaggedAt === undefined ? {} : { flaggedAt: flaggedAt.toISOString() }),
        };
      }),
    );

    return { items: accounts, page: query.filter.page, pageSize: query.filter.pageSize, total };
  }
}
