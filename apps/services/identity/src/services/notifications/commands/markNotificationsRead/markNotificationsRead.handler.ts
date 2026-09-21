import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { MarkNotificationsReadCommand } from "./markNotificationsRead.command.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class MarkNotificationsReadHandler extends CommandHandler<MarkNotificationsReadCommand, number> {
  public readonly commandType = IDENTITY_COMMAND.MARK_NOTIFICATIONS_READ;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: MarkNotificationsReadCommand): Promise<number> {
    if (command.ids?.length === 0) {
      return 0;
    }

    return this.deps.store.notifications.markRead(command.customerId, command.ids, new Date());
  }
}
