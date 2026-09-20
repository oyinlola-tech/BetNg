import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";
import type { MatchStatus } from "@betng/contracts";

/** Asks for matches, optionally narrowed by league and lifecycle state. */
export class ListMatchesQuery extends Query<"match.list-matches"> {
  public readonly leagueId: string | undefined;

  public readonly status: MatchStatus | undefined;

  public constructor(filter: {
    readonly leagueId?: string;
    readonly status?: MatchStatus;
  } = {}) {
    super(MATCH_QUERY.LIST_MATCHES);
    this.leagueId = filter.leagueId;
    this.status = filter.status;
  }
}
