import { Query } from "@zudojs/cqrs";
import type { AdminFixturesQuery } from "../../../../dtos/index.js";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListAdminFixturesQuery extends Query<"match.listAdminFixtures"> {
  public readonly filter: AdminFixturesQuery;

  public constructor(filter: AdminFixturesQuery) {
    super(MATCH_QUERY.LIST_ADMIN_FIXTURES);
    this.filter = filter;
  }
}
