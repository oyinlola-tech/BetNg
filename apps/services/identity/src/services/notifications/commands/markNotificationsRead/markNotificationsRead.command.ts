import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class MarkNotificationsReadCommand extends Command<"identity.markNotificationsRead"> {
  public readonly customerId: string;

  /** `undefined` marks every unread notification. */
  public readonly ids: readonly string[] | undefined;

  public constructor(customerId: string, ids: readonly string[] | undefined) {
    super(IDENTITY_COMMAND.MARK_NOTIFICATIONS_READ);
    this.customerId = customerId;
    this.ids = ids;
  }
}
