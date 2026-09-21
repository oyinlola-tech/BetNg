import { CommandHandler } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import {
  SETTLEMENT_BATCH,
  SETTLEMENT_COMMAND,
  SYSTEM_ACTOR,
} from "../../../../constants/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import { mapWithConcurrency } from "../../../../utils/index.js";
import type { EffectsApplier } from "../../effects.applier.js";
import type { MatchSettler } from "../../match.settler.js";
import type { RetryEffectsCommand } from "./retryEffects.command.js";

export interface RetryEffectsResult {
  readonly attempted: number;
  readonly applied: number;
}

export class RetryEffectsHandler extends CommandHandler<RetryEffectsCommand, RetryEffectsResult> {
  public readonly commandType = SETTLEMENT_COMMAND.RETRY_EFFECTS;

  private readonly settlements: SettlementRepository;
  private readonly effects: EffectsApplier;
  private readonly settler: MatchSettler;
  private readonly logger: Logger;

  public constructor(
    settlements: SettlementRepository,
    effects: EffectsApplier,
    settler: MatchSettler,
    logger: Logger,
  ) {
    super();
    this.settlements = settlements;
    this.effects = effects;
    this.settler = settler;
    this.logger = logger;
  }

  public async execute(command: RetryEffectsCommand): Promise<RetryEffectsResult> {
    const pending = await this.settlements.listUnstamped(SETTLEMENT_BATCH.RETRY_LIMIT);
    const matchIds = new Set<string>();

    const outcomes = await mapWithConcurrency(pending, SETTLEMENT_BATCH.CONCURRENCY, async (settlement) => {
      try {
        await this.effects.apply(settlement, command.requestId);

        for (const leg of settlement.legs) {
          matchIds.add(leg.matchId);
        }

        return true;
      } catch (error) {
        this.logger.warn("Settlement effects still failing", {
          requestId: command.requestId,
          betId: settlement.betId,
          settlementId: settlement.id,
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }
    });

    // A FAILED match settlement is re-run so it reaches COMPLETED once its last bet is stamped.
    for (const matchId of matchIds) {
      const matchSettlement = await this.settlements.findMatchSettlement(matchId);

      if (matchSettlement?.status !== "FAILED") {
        continue;
      }

      try {
        await this.settler.settle({
          matchId,
          kind: matchSettlement.kind,
          actor: { ...SYSTEM_ACTOR, requestId: command.requestId },
        });
      } catch (error) {
        this.logger.warn("Match settlement still failing", {
          requestId: command.requestId,
          matchId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { attempted: pending.length, applied: outcomes.filter(Boolean).length };
  }
}
