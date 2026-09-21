import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { AuditActor } from "../../../../interfaces/index.js";

export interface VoidMatchPayload {
  readonly matchId: string;
  readonly reason: string;
  readonly actor: AuditActor;
}

export class VoidMatchCommand extends Command<"settlement.voidMatch"> {
  public readonly matchId: string;
  public readonly reason: string;
  public readonly actor: AuditActor;

  public constructor(payload: VoidMatchPayload) {
    super(SETTLEMENT_COMMAND.VOID_MATCH);
    this.matchId = payload.matchId;
    this.reason = payload.reason;
    this.actor = payload.actor;
  }
}
