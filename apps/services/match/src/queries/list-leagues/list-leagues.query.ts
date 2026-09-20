import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";

/** Asks for every league the platform runs. */
export class ListLeaguesQuery extends Query<"match.list-leagues"> {
  public constructor() {
    super(MATCH_QUERY.LIST_LEAGUES);
  }
}
