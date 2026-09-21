import type { Logger } from "@betng/service-kit";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  MATCH_SETTLEMENT_KIND,
  SETTLEMENT_BATCH,
} from "../../constants/index.js";
import type { MatchSettlementKind } from "../../constants/index.js";
import {
  MatchNotFoundError,
  SettlementConflictError,
  SettlementFailedError,
} from "../../errors/index.js";
import type {
  AuditActor,
  AuditRecorder,
  PlatformReader,
  SettlementRepository,
} from "../../interfaces/index.js";
import type {
  BetLegRecord,
  BetRecord,
  MatchSettlementRecord,
  SettledLegRecord,
  SettlementRecord,
} from "../../models/index.js";
import {
  chunk,
  evaluateLeg,
  formatResult,
  mapWithConcurrency,
  resolveBet,
} from "../../utils/index.js";
import type { FinalScore } from "../../utils/index.js";
import type { EffectsApplier } from "./effects.applier.js";

export interface MatchSettlerDependencies {
  readonly settlements: SettlementRepository;
  readonly platform: PlatformReader;
  readonly effects: EffectsApplier;
  readonly audit: AuditRecorder;
  readonly logger: Logger;
}

export interface SettleMatchInput {
  readonly matchId: string;
  readonly kind: MatchSettlementKind;
  readonly actor: AuditActor;
  readonly reason?: string;
}

export interface MatchSettlementResult {
  readonly matchId: string;
  readonly status: "STARTED" | "COMPLETED" | "FAILED";
  readonly betsTotal: number;
  readonly betsSettled: number;
  readonly duplicate: boolean;
}

type BetProgress = "settled" | "waiting" | "skipped" | "failed";

interface MatchContext {
  readonly matchId: string;
  readonly kind: MatchSettlementKind;
  readonly score: FinalScore | undefined;
  readonly requestId: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isVoidedMatch(leg: BetLegRecord): boolean {
  return (
    leg.matchLifecycle === "VOIDED" ||
    leg.matchStatus === "CANCELLED" ||
    leg.matchSettlementKind === MATCH_SETTLEMENT_KIND.VOID
  );
}

function toResult(record: MatchSettlementRecord, duplicate: boolean): MatchSettlementResult {
  return {
    matchId: record.matchId,
    status: record.status,
    betsTotal: record.betsTotal,
    betsSettled: record.betsSettled,
    duplicate,
  };
}

export class MatchSettler {
  private readonly settlements: SettlementRepository;
  private readonly platform: PlatformReader;
  private readonly effects: EffectsApplier;
  private readonly audit: AuditRecorder;
  private readonly logger: Logger;

  // Same-match calls are serialised in-process; across processes the unique (bet_id, revision) key guards.
  private readonly queues = new Map<string, Promise<unknown>>();

  public constructor(dependencies: MatchSettlerDependencies) {
    this.settlements = dependencies.settlements;
    this.platform = dependencies.platform;
    this.effects = dependencies.effects;
    this.audit = dependencies.audit;
    this.logger = dependencies.logger;
  }

  public async settle(input: SettleMatchInput): Promise<MatchSettlementResult> {
    const previous = this.queues.get(input.matchId) ?? Promise.resolve();
    const run = previous.then(async () => this.settleExclusively(input));
    const tail = run.catch(() => undefined);

    this.queues.set(input.matchId, tail);

    try {
      return await run;
    } finally {
      if (this.queues.get(input.matchId) === tail) {
        this.queues.delete(input.matchId);
      }
    }
  }

  private async settleExclusively(input: SettleMatchInput): Promise<MatchSettlementResult> {
    const { matchId, actor } = input;
    const match = await this.platform.findMatch(matchId);

    if (match === undefined) {
      throw new MatchNotFoundError(matchId);
    }

    if (input.kind === MATCH_SETTLEMENT_KIND.RESULT && match.status !== "COMPLETED") {
      throw new SettlementConflictError("The match is not completed, so it cannot be settled yet.", {
        matchId,
      });
    }

    const begun = await this.settlements.beginMatchSettlement(matchId, input.kind);

    if (!begun.started) {
      if (begun.record.kind !== input.kind) {
        throw new SettlementConflictError(
          "The match has already been settled the other way and a settlement is never rewritten.",
          { matchId },
        );
      }

      this.logger.info("Match already settled", { requestId: actor.requestId, matchId });

      return toResult(begun.record, true);
    }

    const kind = begun.record.kind;

    this.logger.info("Settlement started", {
      requestId: actor.requestId,
      matchId,
      kind,
      attempt: begun.record.attempts,
    });

    await this.audit.recordBestEffort({
      ...actor,
      action: AUDIT_ACTION.SETTLEMENT_STARTED,
      entityType: AUDIT_ENTITY.MATCH,
      entityId: matchId,
      after: { kind, attempt: begun.record.attempts },
      ...(input.reason === undefined ? {} : { reason: input.reason }),
    });

    let finished: MatchSettlementRecord;
    let failure: unknown;

    try {
      finished = await this.settleBets({
        matchId,
        kind,
        score: kind === MATCH_SETTLEMENT_KIND.RESULT ? await this.platform.findResult(matchId) : undefined,
        requestId: actor.requestId,
      });
    } catch (error) {
      failure = error;
      this.logger.error("Settlement aborted", {
        requestId: actor.requestId,
        matchId,
        error: describe(error),
      });

      finished = await this.settlements.finishMatchSettlement({
        matchId,
        status: "FAILED",
        betsTotal: begun.record.betsTotal,
        betsSettled: begun.record.betsSettled,
        failureReason: "Settlement could not be completed; it will be retried.",
      });
    }

    const completed = finished.status === "COMPLETED";

    await this.audit.recordBestEffort({
      ...actor,
      action: completed ? AUDIT_ACTION.SETTLEMENT_COMPLETED : AUDIT_ACTION.SETTLEMENT_FAILED,
      entityType: AUDIT_ENTITY.MATCH,
      entityId: matchId,
      after: {
        kind,
        status: finished.status,
        betsTotal: finished.betsTotal,
        betsSettled: finished.betsSettled,
        ...(finished.failureReason === null ? {} : { failureReason: finished.failureReason }),
      },
      severity: completed ? "INFO" : "WARNING",
      ...(input.reason === undefined ? {} : { reason: input.reason }),
    });

    if (!completed) {
      throw new SettlementFailedError(
        matchId,
        finished.failureReason ?? "Settlement did not complete.",
        failure,
      );
    }

    this.logger.info("Settlement completed", {
      requestId: actor.requestId,
      matchId,
      betsTotal: finished.betsTotal,
      betsSettled: finished.betsSettled,
    });

    return toResult(finished, false);
  }

  private async settleBets(context: MatchContext): Promise<MatchSettlementRecord> {
    const { matchId } = context;

    if (context.kind === MATCH_SETTLEMENT_KIND.RESULT && context.score === undefined) {
      this.logger.error("No authoritative result for a completed match", {
        requestId: context.requestId,
        matchId,
      });

      return this.settlements.finishMatchSettlement({
        matchId,
        status: "FAILED",
        betsTotal: 0,
        betsSettled: 0,
        failureReason: "The match has no authoritative result.",
      });
    }

    const bets = await this.platform.listBetsOnMatch(matchId);
    const progress: BetProgress[] = [];

    for (const batch of chunk(bets, SETTLEMENT_BATCH.LEG_CHUNK)) {
      const betIds = batch.map((bet) => bet.id);
      const legs = await this.platform.listLegs(betIds);
      const existing = await this.settlements.findByBetIds(betIds);

      const legsByBet = new Map<string, BetLegRecord[]>();

      for (const leg of legs) {
        const group = legsByBet.get(leg.betId) ?? [];

        group.push(leg);
        legsByBet.set(leg.betId, group);
      }

      const settledByBet = new Map(existing.map((settlement) => [settlement.betId, settlement]));

      progress.push(
        ...(await mapWithConcurrency(batch, SETTLEMENT_BATCH.CONCURRENCY, async (bet) =>
          this.settleBet(context, bet, legsByBet.get(bet.id) ?? [], settledByBet.get(bet.id)),
        )),
      );
    }

    const counted = progress.filter((state) => state !== "skipped");
    const settled = counted.filter((state) => state === "settled").length;
    const failed = counted.filter((state) => state === "failed").length;

    return this.settlements.finishMatchSettlement({
      matchId,
      status: failed === 0 ? "COMPLETED" : "FAILED",
      betsTotal: counted.length,
      betsSettled: settled,
      failureReason:
        failed === 0
          ? null
          : `${String(failed)} of ${String(counted.length)} bets could not be settled and paid; they will be retried.`,
    });
  }

  private async settleBet(
    context: MatchContext,
    bet: BetRecord,
    legs: readonly BetLegRecord[],
    existing: SettlementRecord | undefined,
  ): Promise<BetProgress> {
    const log = { requestId: context.requestId, matchId: context.matchId, betId: bet.id };

    try {
      let settlement = existing;

      if (settlement === undefined) {
        if (bet.status !== "PENDING") {
          this.logger.warn("Bet is not pending and has no settlement; left alone", {
            ...log,
            status: bet.status,
          });

          return "skipped";
        }

        const resolved = this.resolveLegs(context, bet, legs);

        if (resolved === undefined) {
          this.logger.info("Bet waits for its other matches", log);

          return "waiting";
        }

        const resolution = resolveBet(
          bet.stake,
          resolved.map((leg) => ({ outcome: leg.settled.outcome, odds: leg.odds })),
        );

        const recorded = await this.settlements.recordSettlement({
          betId: bet.id,
          outcome: resolution.outcome,
          stake: bet.stake,
          payout: resolution.payout,
          channel: bet.channel,
          userId: bet.userId,
          shopId: bet.shopId,
          cashierId: bet.cashierId,
          legs: resolved.map((leg) => leg.settled),
        });

        settlement = recorded.record;

        this.logger.info(recorded.created ? "Bet settled" : "Bet was already settled", {
          ...log,
          settlementId: settlement.id,
          outcome: settlement.outcome,
        });
      }

      await this.effects.apply(settlement, context.requestId);

      return "settled";
    } catch (error) {
      this.logger.error("Bet could not be settled and paid", { ...log, error: describe(error) });

      return "failed";
    }
  }

  // A result exists from kick-off but is used only once its match is COMPLETED, or settling would reveal it.
  private resolveLegs(
    context: MatchContext,
    bet: BetRecord,
    legs: readonly BetLegRecord[],
  ): { readonly settled: SettledLegRecord; readonly odds: string }[] | undefined {
    if (legs.length === 0) {
      throw new Error("The bet has no legs.");
    }

    const resolved: { settled: SettledLegRecord; odds: string }[] = [];

    for (const leg of legs) {
      const onThisMatch = leg.matchId === context.matchId;

      let score: FinalScore | undefined;

      if (onThisMatch ? context.kind === MATCH_SETTLEMENT_KIND.VOID : isVoidedMatch(leg)) {
        resolved.push({
          settled: { selectionId: leg.selectionId, matchId: leg.matchId, outcome: "VOID", result: null },
          odds: leg.odds,
        });
        continue;
      }

      if (onThisMatch) {
        score = context.score;
      } else if (leg.matchStatus === "COMPLETED" && leg.homeGoals !== null && leg.awayGoals !== null) {
        score = { homeGoals: leg.homeGoals, awayGoals: leg.awayGoals };
      }

      if (score === undefined) {
        return undefined;
      }

      const evaluation = evaluateLeg(leg, score);

      if (!evaluation.recognised) {
        this.logger.error("Unknown market or selection code; the leg is void", {
          requestId: context.requestId,
          matchId: leg.matchId,
          betId: bet.id,
          marketType: leg.marketType,
          selectionCode: leg.selectionCode,
        });
      }

      resolved.push({
        settled: {
          selectionId: leg.selectionId,
          matchId: leg.matchId,
          outcome: evaluation.outcome,
          result: formatResult(score),
        },
        odds: leg.odds,
      });
    }

    return resolved;
  }
}
