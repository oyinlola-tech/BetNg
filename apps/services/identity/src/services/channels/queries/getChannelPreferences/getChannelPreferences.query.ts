import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetChannelPreferencesQuery extends Query<"identity.getChannelPreferences"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_CHANNEL_PREFERENCES);
    this.caller = caller;
  }
}
