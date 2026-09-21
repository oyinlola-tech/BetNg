import { CommandHandler } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import { SettlementConflictError, SettlementNotFoundError } from "../../../../errors/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import type { AdminSettlementRecord } from "../../../../models/index.js";
import type { MatchSettler } from "../../match.settler.js";
import type { RetrySettlementCommand } from "./retrySettlement.command.js";

/** The outcome is recalculated from the recorded result, never supplied by the caller. */
export class RetrySettlementHandler extends CommandHandler<RetrySettlementCommand, AdminSettlementRecord> {
  public readonly commandType = SETTLEMENT_COMMAND.RETRY_SETTLEMENT;

  private readonly settlements: SettlementRepository;
  private readonly settler: MatchSettler;

  public constructor(settlements: SettlementRepository, settler: MatchSettler) {
    super();
    this.settlements = settlements;
    this.settler = settler;
  }

  public async execute(command: RetrySettlementCommand): Promise<AdminSettlementRecord> {
    const listed = await this.settlements.findAdminByBet(command.betId);

    if (listed === undefined) {
      throw new SettlementNotFoundError(command.betId);
    }

    if (listed.status !== "FAILED") {
      throw new SettlementConflictError("Only a failed settlement can be retried.", {
        betId: command.betId,
      });
    }

    for (const matchId of listed.failedMatchIds) {
      const matchSettlement = await this.settlements.findMatchSettlement(matchId);

      if (matchSettlement?.status === "FAILED") {
        await this.settler.settle({
          matchId,
          kind: matchSettlement.kind,
          actor: command.actor,
          reason: command.reason,
        });
      }
    }

    return (await this.settlements.findAdminByBet(command.betId)) ?? listed;
  }
}
