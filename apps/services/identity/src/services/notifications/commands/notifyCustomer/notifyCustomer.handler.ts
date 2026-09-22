import { CommandHandler } from "@zudojs/cqrs";
import type { NotificationKind } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { PAYMENT_REFERENCE_PATTERN } from "../../../../dtos/index.js";
import type { NotifiedDto } from "../../../../dtos/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies, NewNotification } from "../../../../interfaces/index.js";
import type { NotifyCustomerCommand } from "./notifyCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "messenger">;

export class NotifyCustomerHandler extends CommandHandler<NotifyCustomerCommand, NotifiedDto> {
  public readonly commandType = IDENTITY_COMMAND.NOTIFY_CUSTOMER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: NotifyCustomerCommand): Promise<NotifiedDto> {
    const { store } = this.deps;

    if ((await store.customers.findById(command.notification.customerId)) === undefined) {
      throw new ResourceNotFoundError("No customer has that id.");
    }

    const incoming = withoutInvalidReference(command.notification);
    const { notification, duplicate } = await store.notifications.createOnce(incoming);

    // Only a first delivery fans out, so a caller's retry with the same dedupe key does not message the customer twice.
    if (!duplicate) {
      void this.deps.messenger.fanOut(incoming.customerId, {
        kind: incoming.kind as NotificationKind,
        title: incoming.title,
        body: incoming.body,
        data: incoming.data,
      });
    }

    return { id: notification.id, duplicate };
  }
}

/** A payment reference is what a client opens when the notification is tapped, so one that fails the contract is dropped. */
function withoutInvalidReference(notification: NewNotification): NewNotification {
  const reference = notification.data?.["reference"];

  if (reference === undefined || (typeof reference === "string" && PAYMENT_REFERENCE_PATTERN.test(reference))) {
    return notification;
  }

  return { ...notification, data: Object.fromEntries(Object.entries(notification.data ?? {}).filter(([key]) => key !== "reference")) };
}
