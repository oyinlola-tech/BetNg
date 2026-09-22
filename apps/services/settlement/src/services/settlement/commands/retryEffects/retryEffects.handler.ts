import { CommandHandler } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import {
  SETTLEMENT_BATCH,
  SETTLEMENT_COMMAND,
  SETTLEMENT_RETRY,
  SYSTEM_ACTOR,
} from "../../../../constants/index.js";
import { isPermanentFailure } from "../../../../errors/index.js";
import type { SettlementRepository } from "../../../../interfaces/index.js";
import { mapWithConcurrency } from "../../../../utils/index.js";
import type { EffectsApplier } from "../../effects.applier.js";
import type { MatchSettler } from "../../match.settler.js";
import type { RetryEffectsCommand } from "./retryEffects.command.js";

export interface RetryEffectsResult {
  readonly attempted: number;
  readonly applied: number;
  readonly backingOff: number;
}

interface Backoff {
  readonly failures: number;
  readonly nextAt: number;
}

// The first two consecutive failures retry on the next pass; after that the wait doubles up to the cap.
export function effectsBackoffMs(failures: number, permanent: boolean): number {
  if (permanent) {
    return SETTLEMENT_RETRY.EFFECTS_BACKOFF_MAX_MS;
  }

  if (failures < 3) {
    return 0;
  }

  return Math.min(
    SETTLEMENT_RETRY.EFFECTS_BACKOFF_MAX_MS,
    SETTLEMENT_RETRY.EFFECTS_BACKOFF_BASE_MS * 2 ** Math.min(failures - 3, 16),
  );
}

export class RetryEffectsHandler extends CommandHandler<RetryEffectsCommand, RetryEffectsResult> {
  public readonly commandType = SETTLEMENT_COMMAND.RETRY_EFFECTS;

  private readonly settlements: SettlementRepository;
  private readonly effects: EffectsApplier;
  private readonly settler: MatchSettler;
  private readonly logger: Logger;
  private readonly clock: () => number;

  // In-process only: a restart retries everything once, which the idempotent effects make harmless.
  private readonly backoff = new Map<string, Backoff>();

  public constructor(
    settlements: SettlementRepository,
    effects: EffectsApplier,
    settler: MatchSettler,
    logger: Logger,
    clock: () => number = Date.now,
  ) {
    super();
    this.settlements = settlements;
    this.effects = effects;
    this.settler = settler;
    this.logger = logger;
    this.clock = clock;
  }

  public async execute(command: RetryEffectsCommand): Promise<RetryEffectsResult> {
    const now = this.clock();
    const waiting = [...this.backoff].filter(([, state]) => state.nextAt > now).map(([id]) => id);
    const pending = await this.settlements.listUnstamped(SETTLEMENT_BATCH.RETRY_LIMIT, waiting);
    const pendingIds = new Set(pending.map((settlement) => settlement.id));
    const matchIds = new Set<string>();

    for (const [id, state] of this.backoff) {
      if (state.nextAt <= now && !pendingIds.has(id)) {
        this.backoff.delete(id);
      }
    }

    const outcomes = await mapWithConcurrency(pending, SETTLEMENT_BATCH.CONCURRENCY, async (settlement) => {
      try {
        await this.effects.apply(settlement, command.requestId);
        this.backoff.delete(settlement.id);

        for (const leg of settlement.legs) {
          matchIds.add(leg.matchId);
        }

        return true;
      } catch (error) {
        const permanent = isPermanentFailure(error);
        const failures = (this.backoff.get(settlement.id)?.failures ?? 0) + 1;
        const alert = permanent || failures >= SETTLEMENT_RETRY.EFFECTS_ALERT_AFTER;

        this.backoff.set(settlement.id, {
          failures,
          nextAt: this.clock() + effectsBackoffMs(failures, permanent),
        });

        this.logger[alert ? "error" : "warn"]("Settlement effects still failing", {
          requestId: command.requestId,
          betId: settlement.betId,
          settlementId: settlement.id,
          event: alert ? "settlement.effects_stuck" : "settlement.effects_failed",
          alert,
          failures,
          permanent,
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

    return {
      attempted: pending.length,
      applied: outcomes.filter(Boolean).length,
      backingOff: waiting.length,
    };
  }
}
