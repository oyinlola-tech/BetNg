import { CommandHandler } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import type {
  BetRepository,
  SettlementResult,
} from "../../../../interfaces/index.js";
import type { ApplySettlementCommand } from "./applySettlement.command.js";

// Outcome and payout come from settlement; betting only records them, once, from PENDING.
export class ApplySettlementHandler extends CommandHandler<
  ApplySettlementCommand,
  SettlementResult
> {
  public readonly commandType = BETTING_COMMAND.APPLY_SETTLEMENT;

  private readonly bets: BetRepository;

  private readonly logger: Logger;

  public constructor(bets: BetRepository, logger: Logger) {
    super();
    this.bets = bets;
    this.logger = logger;
  }

  public async execute(
    command: ApplySettlementCommand,
  ): Promise<SettlementResult> {
    const result = await this.bets.applySettlement(command.settlement);

    if (result.kind === "APPLIED") {
      this.logger.info("Settlement applied", {
        requestId: command.requestId,
        betId: command.settlement.betId,
        event: "settlement_applied",
        status: result.status,
      });
    } else if (result.kind !== "UNCHANGED") {
      this.logger.warn("Settlement refused", {
        requestId: command.requestId,
        betId: command.settlement.betId,
        event: "settlement_refused",
        reason: result.kind,
      });
    }

    return result;
  }
}
