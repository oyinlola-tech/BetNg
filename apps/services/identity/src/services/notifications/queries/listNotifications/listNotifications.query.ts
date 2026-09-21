import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListNotificationsQuery extends Query<"identity.listNotifications"> {
  public readonly customerId: string;

  public readonly limit: number;

  public constructor(customerId: string, limit: number) {
    super(IDENTITY_QUERY.LIST_NOTIFICATIONS);
    this.customerId = customerId;
    this.limit = limit;
  }
}
