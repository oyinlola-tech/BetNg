import { Query } from "@zudojs/cqrs";
import type { ListFixturesQuery } from "../../../../dtos/index.js";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListFixturesQuery extends Query<"match.listFixtures"> {
  public readonly filter: ListFixturesQuery;

  public constructor(filter: ListFixturesQuery) {
    super(MATCH_QUERY.LIST_FIXTURES);
    this.filter = filter;
  }
}
