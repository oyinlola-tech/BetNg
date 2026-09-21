import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { AuditActor } from "../../../../interfaces/index.js";

export interface SettleMatchPayload {
  readonly matchId: string;
  readonly actor: AuditActor;
  readonly reason?: string;
}

export class SettleMatchCommand extends Command<"settlement.settleMatch"> {
  public readonly matchId: string;
  public readonly actor: AuditActor;
  public readonly reason: string | undefined;

  public constructor(payload: SettleMatchPayload) {
    super(SETTLEMENT_COMMAND.SETTLE_MATCH);
    this.matchId = payload.matchId;
    this.actor = payload.actor;
    this.reason = payload.reason;
  }
}
