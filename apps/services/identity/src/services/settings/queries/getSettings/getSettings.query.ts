import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetSettingsQuery extends Query<"identity.getSettings"> {
  public constructor() {
    super(IDENTITY_QUERY.GET_SETTINGS);
  }
}
