import { QueryHandler } from "@zudojs/cqrs";
import type { Notification } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toNotification } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListNotificationsQuery } from "./listNotifications.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class ListNotificationsHandler extends QueryHandler<ListNotificationsQuery, readonly Notification[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_NOTIFICATIONS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListNotificationsQuery): Promise<readonly Notification[]> {
    const rows = await this.deps.store.notifications.listForCustomer(query.customerId, query.limit);

    return rows.map(toNotification);
  }
}
