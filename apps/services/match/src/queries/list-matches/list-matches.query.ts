import { Query } from "@zudojs/cqrs";
import type { MatchStatus } from "@betng/contracts";

/** Asks for matches, optionally narrowed by league and lifecycle state. */
export class ListMatchesQuery extends Query<"match.list-matches"> {
  public readonly leagueId: string | undefined;

  public readonly status: MatchStatus | undefined;

  public constructor(filter: {
    readonly leagueId?: string;
    readonly status?: MatchStatus;
  } = {}) {
    super("match.list-matches");
    this.leagueId = filter.leagueId;
    this.status = filter.status;
  }
}
