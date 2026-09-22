import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { ResponsibleGamingFilter } from "../../../../interfaces/index.js";

export class ListResponsibleGamingQuery extends Query<"identity.listResponsibleGaming"> {
  public readonly filter: ResponsibleGamingFilter;

  public constructor(filter: ResponsibleGamingFilter) {
    super(IDENTITY_QUERY.LIST_RESPONSIBLE_GAMING);
    this.filter = filter;
  }
}
