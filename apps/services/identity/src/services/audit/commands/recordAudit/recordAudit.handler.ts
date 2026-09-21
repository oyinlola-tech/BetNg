import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AuditRecordedDto } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { RecordAuditCommand } from "./recordAudit.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit">;

export class RecordAuditHandler extends CommandHandler<RecordAuditCommand, AuditRecordedDto> {
  public readonly commandType = IDENTITY_COMMAND.RECORD_AUDIT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RecordAuditCommand): Promise<AuditRecordedDto> {
    return { id: await this.deps.audit.write(this.deps.store, command.entry) };
  }
}
