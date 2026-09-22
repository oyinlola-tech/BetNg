import { CommandHandler } from "@zudojs/cqrs";
import type { NotificationKind } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { NotifiedDto } from "../../../../dtos/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
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

    const { notification, duplicate } = await store.notifications.createOnce(command.notification);

    // Only a first delivery fans out, so a caller's retry with the same dedupe key does not message the customer twice.
    if (!duplicate) {
      void this.deps.messenger.fanOut(command.notification.customerId, {
        kind: command.notification.kind as NotificationKind,
        title: command.notification.title,
        body: command.notification.body,
        data: command.notification.data,
      });
    }

    return { id: notification.id, duplicate };
  }
}
