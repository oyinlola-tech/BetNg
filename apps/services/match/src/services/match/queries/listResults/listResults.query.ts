import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListResultsQuery extends Query<"match.listResults"> {
  public readonly leagueId: string | undefined;

  public readonly limit: number | undefined;

  public constructor(payload: {
    readonly leagueId: string | undefined;
    readonly limit: number | undefined;
  }) {
    super(MATCH_QUERY.LIST_RESULTS);
    this.leagueId = payload.leagueId;
    this.limit = payload.limit;
  }
}
