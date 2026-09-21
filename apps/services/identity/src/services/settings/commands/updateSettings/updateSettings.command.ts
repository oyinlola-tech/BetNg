import { Command } from "@zudojs/cqrs";
import type { PlatformSettings } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class UpdateSettingsCommand extends Command<"identity.updateSettings"> {
  public readonly actor: AdminActor;

  public readonly changes: Partial<PlatformSettings>;

  public readonly reason: string;

  public constructor(actor: AdminActor, changes: Partial<PlatformSettings>, reason: string) {
    super(IDENTITY_COMMAND.UPDATE_SETTINGS);
    this.actor = actor;
    this.changes = changes;
    this.reason = reason;
  }
}
