import { Query } from "@zudojs/cqrs";
import type { ListMatchesQuery as ListMatchesFilter } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListMatchesQuery extends Query<"match.listMatches"> {
  public readonly filter: ListMatchesFilter;

  public constructor(filter: ListMatchesFilter) {
    super(MATCH_QUERY.LIST_MATCHES);
    this.filter = filter;
  }
}
