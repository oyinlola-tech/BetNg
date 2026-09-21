import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { AuditActor } from "../../../../interfaces/index.js";

export interface UpdateCommissionConfigPayload {
  readonly shopId?: string;
  readonly shopSharePercent: number;
  readonly reason: string;
  readonly actor: AuditActor;
}

export class UpdateCommissionConfigCommand extends Command<"settlement.updateCommissionConfig"> {
  public readonly shopId: string | undefined;
  public readonly shopSharePercent: number;
  public readonly reason: string;
  public readonly actor: AuditActor;

  public constructor(payload: UpdateCommissionConfigPayload) {
    super(SETTLEMENT_COMMAND.UPDATE_COMMISSION_CONFIG);
    this.shopId = payload.shopId;
    this.shopSharePercent = payload.shopSharePercent;
    this.reason = payload.reason;
    this.actor = payload.actor;
  }
}
