import { Query } from "@zudojs/cqrs";
import type { ListFixturesQuery as ListFixturesFilter } from "../../../../dtos/index.js";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListFixturesQuery extends Query<"match.listFixtures"> {
  public readonly filter: ListFixturesFilter;

  public constructor(filter: ListFixturesFilter) {
    super(MATCH_QUERY.LIST_FIXTURES);
    this.filter = filter;
  }
}
