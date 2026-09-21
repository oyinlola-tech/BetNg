import { CommandHandler } from "@zudojs/cqrs";
import { MATCH_SETTLEMENT_KIND, SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import type { MatchSettlementResult, MatchSettler } from "../../match.settler.js";
import type { SettleMatchCommand } from "./settleMatch.command.js";

export class SettleMatchHandler extends CommandHandler<SettleMatchCommand, MatchSettlementResult> {
  public readonly commandType = SETTLEMENT_COMMAND.SETTLE_MATCH;

  private readonly settler: MatchSettler;

  public constructor(settler: MatchSettler) {
    super();
    this.settler = settler;
  }

  public async execute(command: SettleMatchCommand): Promise<MatchSettlementResult> {
    return this.settler.settle({
      matchId: command.matchId,
      kind: MATCH_SETTLEMENT_KIND.RESULT,
      actor: command.actor,
      ...(command.reason === undefined ? {} : { reason: command.reason }),
    });
  }
}
