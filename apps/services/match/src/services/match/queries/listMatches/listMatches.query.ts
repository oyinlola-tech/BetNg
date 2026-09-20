import { Query } from "@zudojs/cqrs";
import type { MatchStatus } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListMatchesQuery extends Query<"match.listMatches"> {
  public readonly leagueId: string | undefined;

  public readonly status: MatchStatus | undefined;

  public constructor(
    filter: {
      readonly leagueId?: string;
      readonly status?: MatchStatus;
    } = {},
  ) {
    super(MATCH_QUERY.LIST_MATCHES);
    this.leagueId = filter.leagueId;
    this.status = filter.status;
  }
}
