import { ErrorCodes } from "@betng/contracts";
import type { Notification } from "@betng/contracts";
import { forbidden, parseBody, parseQuery, requireActor, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import { ListNotificationsQuery, MarkNotificationsReadCommand } from "../services/index.js";
import {
  idParamValidator,
  listNotificationsQueryValidator,
  markNotificationsReadValidator,
} from "../validators/index.js";

export interface NotificationController {
  readonly list: (context: HttpRouterContext) => Promise<ListDto<Notification>>;
  readonly markRead: (context: HttpRouterContext) => Promise<void>;
}

const SELF = "me";

/** The inbox is always the actor's own: the path id is only checked against the actor, never used to read. */
function ownCustomerId(context: HttpRouterContext): string {
  const actor = requireActor(context.request, { kind: "CUSTOMER" });
  const requested = requireParam(context.params, "id");

  if (
    (requested !== SELF && requested !== actor.id) ||
    !validate(idParamValidator, actor.id).success
  ) {
    throw forbidden("You do not have permission to do this.", {
      code: ErrorCodes.FORBIDDEN,
      expose: true,
    });
  }

  return actor.id;
}

export function createNotificationController(buses: IdentityBuses): NotificationController {
  const { commandBus, queryBus } = buses;

  return {
    list: async (context) => {
      const customerId = ownCustomerId(context);
      const { limit } = parseQuery(context.query, listNotificationsQueryValidator);

      return {
        items: await queryBus.execute<ListNotificationsQuery, readonly Notification[]>(
          new ListNotificationsQuery(customerId, limit),
        ),
      };
    },

    markRead: async (context) => {
      const customerId = ownCustomerId(context);
      const { ids } = parseBody(context.request, markNotificationsReadValidator);

      await commandBus.execute<MarkNotificationsReadCommand, number>(
        new MarkNotificationsReadCommand(customerId, ids),
      );
    },
  };
}
