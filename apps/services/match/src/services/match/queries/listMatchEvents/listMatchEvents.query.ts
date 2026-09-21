import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListMatchEventsQuery extends Query<"match.listMatchEvents"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.LIST_MATCH_EVENTS);
    this.matchId = matchId;
  }
}
