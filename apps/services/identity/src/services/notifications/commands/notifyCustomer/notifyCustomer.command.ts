import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { NewNotification } from "../../../../interfaces/index.js";

export class NotifyCustomerCommand extends Command<"identity.notifyCustomer"> {
  public readonly notification: NewNotification;

  public constructor(notification: NewNotification) {
    super(IDENTITY_COMMAND.NOTIFY_CUSTOMER);
    this.notification = notification;
  }
}
