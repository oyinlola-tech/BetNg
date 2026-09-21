import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AuditEntryInput } from "../../../../interfaces/index.js";

export class RecordAuditCommand extends Command<"identity.recordAudit"> {
  public readonly entry: AuditEntryInput;

  public constructor(entry: AuditEntryInput) {
    super(IDENTITY_COMMAND.RECORD_AUDIT);
    this.entry = entry;
  }
}
