import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListScorersQuery extends Query<"match.listScorers"> {
  public readonly leagueId: string;

  public readonly season: number | undefined;

  public readonly limit: number | undefined;

  public constructor(payload: {
    readonly leagueId: string;
    readonly season: number | undefined;
    readonly limit: number | undefined;
  }) {
    super(MATCH_QUERY.LIST_SCORERS);
    this.leagueId = payload.leagueId;
    this.season = payload.season;
    this.limit = payload.limit;
  }
}
