import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

/** Asks for every scheduled fixture. */
export class ListFixturesQuery extends Query<"match.listFixtures"> {
  public constructor() {
    super(MATCH_QUERY.LIST_FIXTURES);
  }
}
