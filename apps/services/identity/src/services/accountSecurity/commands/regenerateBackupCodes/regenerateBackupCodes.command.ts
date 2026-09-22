import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RegenerateBackupCodesCommand extends Command<"identity.regenerateBackupCodes"> {
  public readonly caller: CustomerCaller;

  public readonly code: string;

  public constructor(caller: CustomerCaller, code: string) {
    super(IDENTITY_COMMAND.REGENERATE_BACKUP_CODES);
    this.caller = caller;
    this.code = code;
  }
}
