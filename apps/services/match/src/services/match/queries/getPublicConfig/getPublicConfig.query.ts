import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetPublicConfigQuery extends Query<"match.getPublicConfig"> {
  public constructor() {
    super(MATCH_QUERY.GET_PUBLIC_CONFIG);
  }
}
