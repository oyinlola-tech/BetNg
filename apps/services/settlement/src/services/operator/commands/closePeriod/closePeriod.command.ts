import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { AuditActor } from "../../../../interfaces/index.js";
import type { OperatorPeriodKind } from "../../../../models/index.js";

export interface ClosePeriodPayload {
  readonly reason: string;
  readonly nextKind?: OperatorPeriodKind;
  readonly actor: AuditActor;
}

export class ClosePeriodCommand extends Command<"settlement.closePeriod"> {
  public readonly reason: string;
  public readonly nextKind: OperatorPeriodKind;
  public readonly actor: AuditActor;

  public constructor(payload: ClosePeriodPayload) {
    super(SETTLEMENT_COMMAND.CLOSE_PERIOD);
    this.reason = payload.reason;
    this.nextKind = payload.nextKind ?? "DAY";
    this.actor = payload.actor;
  }
}
