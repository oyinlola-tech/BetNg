import { CommandHandler } from "@zudojs/cqrs";
import { MATCH_SETTLEMENT_KIND, SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { MatchSettlementResult, MatchSettler } from "../../match.settler.js";
import type { VoidMatchCommand } from "./voidMatch.command.js";

export class VoidMatchHandler extends CommandHandler<VoidMatchCommand, MatchSettlementResult> {
  public readonly commandType = SETTLEMENT_COMMAND.VOID_MATCH;

  private readonly settler: MatchSettler;

  public constructor(settler: MatchSettler) {
    super();
    this.settler = settler;
  }

  public async execute(command: VoidMatchCommand): Promise<MatchSettlementResult> {
    return this.settler.settle({
      matchId: command.matchId,
      kind: MATCH_SETTLEMENT_KIND.VOID,
      actor: command.actor,
      reason: command.reason,
    });
  }
}
