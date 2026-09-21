import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetStandingsQuery extends Query<"match.getStandings"> {
  public readonly leagueId: string;

  public readonly season: number | undefined;

  public constructor(payload: {
    readonly leagueId: string;
    readonly season: number | undefined;
  }) {
    super(MATCH_QUERY.GET_STANDINGS);
    this.leagueId = payload.leagueId;
    this.season = payload.season;
  }
}
