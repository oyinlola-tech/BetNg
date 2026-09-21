import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { AuditActor } from "../../../../interfaces/index.js";

export interface RetrySettlementPayload {
  readonly betId: string;
  readonly reason: string;
  readonly actor: AuditActor;
}

export class RetrySettlementCommand extends Command<"settlement.retrySettlement"> {
  public readonly betId: string;
  public readonly reason: string;
  public readonly actor: AuditActor;

  public constructor(payload: RetrySettlementPayload) {
    super(SETTLEMENT_COMMAND.RETRY_SETTLEMENT);
    this.betId = payload.betId;
    this.reason = payload.reason;
    this.actor = payload.actor;
  }
}
