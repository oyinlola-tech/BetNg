import { randomUUID } from "node:crypto";
import { asId, ErrorCodes, teamStrengthSchema } from "@betng/contracts";
import type {
  LiveEventType,
  MatchLifecycle,
  RunMatchResponse,
  TeamStrength,
} from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { MatchTiming } from "../../configs/index.js";
import { SCHEDULER } from "../../constants/index.js";
import {
  MatchConflictError,
  PeerFailedError,
  ResultImmutableError,
} from "../../errors/index.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  BettingReader,
  CatalogueRepository,
  Clock,
  LifecycleRepository,
  MatchRecord,
  MatchRepository,
  MatchSettlementResult,
  Peers,
  SimulationReader,
} from "../../interfaces/index.js";
import {
  alignToLeagueGrid,
  backoffMs,
  buildSeason,
  errorMessage,
  failureReason,
  fullTimeMs,
  PeerAnswerError,
  revealInstantMs,
  toTeamStrength,
} from "../../utils/index.js";

export interface LifecycleActor {
  readonly id: string;
  readonly role: string;
  /** What `match_transitions.actor` records: `system` or `admin:<id>`. */
  readonly label: string;
}

export const SYSTEM_ACTOR: LifecycleActor = Object.freeze({
  id: SCHEDULER.SYSTEM_ACTOR,
  role: "SYSTEM",
  label: SCHEDULER.SYSTEM_ACTOR,
});

export interface LifecycleDependencies {
  readonly catalogue: CatalogueRepository;
  readonly matches: MatchRepository;
  readonly lifecycle: LifecycleRepository;
  readonly simulation: SimulationReader;
  readonly betting: BettingReader;
  readonly peers: Peers;
  readonly timing: MatchTiming;
  readonly clock: Clock;
  readonly logger: Logger;
}

interface StepContext {
  readonly actor: LifecycleActor;
  readonly requestId: string;
  readonly reason?: string;
  readonly throwOnFailure: boolean;
}

const strengthSchema: ValidationSchema<TeamStrength> = teamStrengthSchema;

const LIVE_EVENT_TYPE: Readonly<Record<string, LiveEventType>> = Object.freeze({
  KICK_OFF: "KICKOFF",
  FULL_TIME: "MATCH_FINISHED",
});

/** A rating change applies to matches not yet priced: a priced match is simulated on the ratings its odds used. */
function pricedStrength(stored: unknown): TeamStrength | undefined {
  const parsed = validate(strengthSchema, stored);

  return parsed.success ? parsed.data : undefined;
}

/** Close is retried every couple of seconds: betting is already shut by the clock, only the bookkeeping waits. */
const CLOSE_RETRY_MS = 2000;

export interface LifecycleService {
  tick(): Promise<void>;
  openBetting(
    matchId: string,
    actor: LifecycleActor,
    reason: string,
    requestId: string,
  ): Promise<void>;
  closeBetting(
    matchId: string,
    actor: LifecycleActor,
    reason: string,
    requestId: string,
  ): Promise<void>;
  startSimulation(
    matchId: string,
    actor: LifecycleActor,
    reason: string,
    requestId: string,
    mode: "START" | "RERUN",
  ): Promise<void>;
  voidMatch(
    matchId: string,
    actor: LifecycleActor,
    reason: string,
    requestId: string,
  ): Promise<void>;
}

export function createLifecycleService(
  deps: LifecycleDependencies,
): LifecycleService {
  const {
    catalogue,
    matches,
    lifecycle,
    simulation,
    betting,
    peers,
    timing,
    clock,
    logger,
  } = deps;

  /** Set when the event service fails, so one outage costs a tick one timeout rather than one per event. */
  let liveStreamDown = false;

  function label(match: MatchRecord): string {
    return `${match.fixture.homeTeam.name} v ${match.fixture.awayTeam.name}`;
  }

  async function advance(
    match: MatchRecord,
    from: MatchLifecycle,
    path: readonly MatchLifecycle[],
    context: StepContext,
    patch?: Prisma.MatchUncheckedUpdateManyInput,
    reason?: string,
  ): Promise<boolean> {
    const note = reason ?? context.reason;
    const moved = await lifecycle.transition({
      matchId: match.id,
      from,
      path,
      actor: context.actor.label,
      at: clock(),
      ...(note === undefined ? {} : { reason: note }),
      ...(patch === undefined ? {} : { patch }),
    });

    if (moved) {
      logger.info("Match transition", {
        event: "match.transition",
        matchId: match.id,
        from,
        to: path[path.length - 1],
        actor: context.actor.label,
        requestId: context.requestId,
      });
    }

    return moved;
  }

  async function publishLive(
    match: MatchRecord,
    event: {
      readonly type: LiveEventType;
      readonly minute: number;
      readonly side?: "HOME" | "AWAY";
      readonly score: { readonly home: number; readonly away: number };
      readonly description: string;
    },
    requestId: string,
  ): Promise<void> {
    if (liveStreamDown) return;

    try {
      await peers.event.publish({ matchId: match.id, ...event }, requestId);
    } catch (error) {
      liveStreamDown = true;
      logger.warn("Live event not published; clients re-read over REST", {
        event: "match.liveEventFailed",
        matchId: match.id,
        type: event.type,
        requestId,
        error: errorMessage(error),
      });
    }
  }

  async function publishMilestone(
    match: MatchRecord,
    type: LiveEventType,
    description: string,
    requestId: string,
  ): Promise<void> {
    const completed = match.status === "COMPLETED";

    await publishLive(
      match,
      {
        type,
        minute: completed ? 90 : 0,
        score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
        description,
      },
      requestId,
    );
  }

  /** Lifecycle audit entries are best effort: a missing entry is logged, it never blocks the match. */
  async function audit(
    action: string,
    match: MatchRecord,
    context: StepContext,
    detail: {
      readonly after?: unknown;
      readonly reason?: string;
      readonly severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
    } = {},
  ): Promise<void> {
    try {
      await peers.identity.recordAudit({
        actorId: context.actor.id,
        actorRole: context.actor.role,
        action,
        entityType: "match",
        entityId: match.id,
        ...(detail.after === undefined ? {} : { after: detail.after }),
        ...(detail.reason === undefined ? {} : { reason: detail.reason }),
        severity: detail.severity ?? "INFO",
        requestId: context.requestId,
      });
    } catch (error) {
      logger.warn("Audit entry not written", {
        event: "match.auditFailed",
        matchId: match.id,
        action,
        requestId: context.requestId,
        error: errorMessage(error),
      });
    }
  }

  async function ensureRounds(now: Date): Promise<void> {
    const leadMs =
      (timing.bettingCloseLeadSeconds + SCHEDULER.ROUND_MARGIN_SECONDS) * 1000;

    for (const league of await catalogue.listLeagues()) {
      if (league.status !== "ACTIVE") continue;

      let upcoming = await matches.countUpcomingRounds(league.id, now);

      if (upcoming >= timing.upcomingRounds) continue;

      const teams = (await catalogue.listTeams(league.id))
        .filter((team) => team.status === "ACTIVE")
        .sort(
          (a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id),
        );
      const season = buildSeason(teams.map((team) => team.id));

      if (season.length === 0) continue;

      let cursor = await matches.latestScheduledRound(league.id);

      while (upcoming < timing.upcomingRounds) {
        const next =
          cursor === undefined
            ? { season: 1, matchday: 1 }
            : cursor.matchday >= season.length
              ? { season: cursor.season + 1, matchday: 1 }
              : { season: cursor.season, matchday: cursor.matchday + 1 };
        const earliest = Math.max(
          cursor === undefined
            ? 0
            : cursor.kickoffAt.getTime() + timing.roundCycleSeconds * 1000,
          now.getTime() + leadMs,
        );
        const kickoffAt = new Date(
          alignToLeagueGrid(earliest, league.staggerSeconds, timing),
        );
        const bettingClosesAt = new Date(
          kickoffAt.getTime() - timing.bettingCloseLeadSeconds * 1000,
        );
        const pairings = season[next.matchday - 1] ?? [];

        const created = await matches.createFixtures(
          pairings.map((pairing) => ({
            leagueId: league.id,
            ...next,
            ...pairing,
            kickoffAt,
            bettingClosesAt,
          })),
          { source: "SCHEDULER", actor: SYSTEM_ACTOR.label, at: now },
        );

        logger.info("Round created", {
          event: "match.roundCreated",
          leagueId: league.id,
          season: next.season,
          matchday: next.matchday,
          kickoffAt: kickoffAt.toISOString(),
          matches: created.length,
        });

        cursor = { ...next, kickoffAt };
        upcoming += 1;
      }
    }
  }

  async function openOne(
    match: MatchRecord,
    context: StepContext,
  ): Promise<boolean> {
    const home = toTeamStrength(match.fixture.homeTeam);
    const away = toTeamStrength(match.fixture.awayTeam);

    try {
      await peers.odds.publishMarkets(
        { matchId: match.id, home, away },
        context.requestId,
      );
    } catch (error) {
      const reason = failureReason(ErrorCodes.ODDS_UNAVAILABLE, error);

      await lifecycle.recordFailure(
        match.id,
        "FIXTURE_CREATED",
        reason,
        new Date(clock().getTime() + backoffMs(match.failureCount + 1)),
      );
      logger.warn("Markets not published", {
        event: "match.oddsUnavailable",
        code: ErrorCodes.ODDS_UNAVAILABLE,
        matchId: match.id,
        requestId: context.requestId,
        reason,
        error: errorMessage(error),
      });

      if (context.throwOnFailure) {
        throw new PeerFailedError(
          ErrorCodes.ODDS_UNAVAILABLE,
          "The odds service could not publish this match's markets.",
        );
      }

      return false;
    }

    const opened = await advance(
      match,
      "FIXTURE_CREATED",
      ["MARKETS_CREATED", "ODDS_PUBLISHED", "BETTING_OPEN"],
      context,
      {
        bettingOpenedAt: clock(),
        homeStrength: home,
        awayStrength: away,
        failureCount: 0,
        failureReason: null,
      },
    );

    if (opened) {
      await publishMilestone(
        match,
        "BETTING_OPENED",
        `Betting is open: ${label(match)}.`,
        context.requestId,
      );
    } else if (context.throwOnFailure) {
      throw new MatchConflictError(
        "The match changed state while betting was being opened. Reload and try again.",
      );
    }

    return true;
  }

  async function publishMarkets(
    now: Date,
    context: StepContext,
  ): Promise<void> {
    const due = await lifecycle.listDue({
      states: ["FIXTURE_CREATED"],
      now,
      bettingClosesAfter: now,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of due) {
      if (
        await lifecycle.claim(
          match.id,
          "FIXTURE_CREATED",
          now,
          new Date(now.getTime() + SCHEDULER.LEASE_MS),
        )
      ) {
        if (!(await openOne(match, context))) break;
      }
    }

    // A match whose markets never opened still has to be played: it goes on with betting closed and no bets.
    const missed = await lifecycle.listDue({
      states: ["FIXTURE_CREATED"],
      now,
      bettingClosesBy: now,
      ignoreLease: true,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of missed) {
      const closed = await advance(
        match,
        "FIXTURE_CREATED",
        ["BETTING_CLOSED"],
        context,
        { bettingClosedAt: now },
        `${ErrorCodes.ODDS_UNAVAILABLE}: markets were never published; the match is played without betting.`,
      );

      if (closed) {
        await peers.odds
          .setMatchMarketsStatus(match.id, "CLOSED", context.requestId)
          .catch(() => undefined);
      }
    }
  }

  async function markActive(now: Date, context: StepContext): Promise<void> {
    const open = await lifecycle.listDue({
      states: ["BETTING_OPEN"],
      now,
      ignoreLease: true,
      limit: SCHEDULER.BATCH_SIZE,
    });
    const withBets = new Set(
      await betting.matchesWithBets(open.map((match) => match.id)),
    );

    for (const match of open) {
      if (withBets.has(match.id)) {
        await advance(match, "BETTING_OPEN", ["BETTING_ACTIVE"], context);
      }
    }
  }

  async function closeOne(
    match: MatchRecord,
    context: StepContext,
  ): Promise<boolean> {
    const from = match.lifecycle as MatchLifecycle;

    try {
      await peers.odds.setMatchMarketsStatus(
        match.id,
        "CLOSED",
        context.requestId,
      );
    } catch (error) {
      const reason = failureReason(ErrorCodes.ODDS_UNAVAILABLE, error);

      await lifecycle.recordFailure(
        match.id,
        from,
        reason,
        new Date(clock().getTime() + CLOSE_RETRY_MS),
      );
      logger.warn("Markets not closed", {
        event: "match.oddsUnavailable",
        code: ErrorCodes.ODDS_UNAVAILABLE,
        matchId: match.id,
        requestId: context.requestId,
        reason,
        error: errorMessage(error),
      });

      if (context.throwOnFailure) {
        throw new PeerFailedError(
          ErrorCodes.ODDS_UNAVAILABLE,
          "The odds service could not close this match's markets.",
        );
      }

      return false;
    }

    try {
      await peers.risk.freezeExposure(match.id, context.requestId);
    } catch (error) {
      logger.warn("Exposure not frozen", {
        event: "match.riskUnavailable",
        code: ErrorCodes.RISK_UNAVAILABLE,
        matchId: match.id,
        requestId: context.requestId,
        error: errorMessage(error),
      });
    }

    const closed = await advance(match, from, ["BETTING_CLOSED"], context, {
      bettingClosedAt: clock(),
      failureCount: 0,
      failureReason: null,
    });

    if (closed) {
      await publishMilestone(
        match,
        "BETTING_CLOSED",
        `Betting is closed: ${label(match)}.`,
        context.requestId,
      );
    } else if (context.throwOnFailure) {
      throw new MatchConflictError(
        "The match changed state while betting was being closed. Reload and try again.",
      );
    }

    return true;
  }

  async function closeBettingStep(
    now: Date,
    context: StepContext,
  ): Promise<void> {
    const due = await lifecycle.listDue({
      states: ["BETTING_OPEN", "BETTING_ACTIVE"],
      now,
      bettingClosesBy: now,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of due) {
      const state = match.lifecycle as MatchLifecycle;

      if (
        await lifecycle.claim(
          match.id,
          state,
          now,
          new Date(now.getTime() + SCHEDULER.LEASE_MS),
        )
      ) {
        if (!(await closeOne(match, context))) break;
      }
    }
  }

  async function failStep(
    match: MatchRecord,
    from: "SIMULATION_STARTED" | "SETTLEMENT_STARTED",
    to: "SIMULATION_FAILED" | "SETTLEMENT_FAILED",
    error: unknown,
    context: StepContext,
  ): Promise<void> {
    const code =
      to === "SIMULATION_FAILED"
        ? ErrorCodes.SIMULATION_FAILED
        : ErrorCodes.SETTLEMENT_FAILED;
    const reason = failureReason(code, error);
    const attempts = match.failureCount + 1;

    await advance(
      match,
      from,
      [to],
      context,
      {
        failureReason: reason,
        failureCount: { increment: 1 },
        nextAttemptAt: new Date(clock().getTime() + backoffMs(attempts)),
      },
      reason,
    );
    logger.error(
      to === "SIMULATION_FAILED" ? "Simulation failed" : "Settlement failed",
      {
        event:
          to === "SIMULATION_FAILED"
            ? "match.simulationFailed"
            : "match.settlementFailed",
        code,
        matchId: match.id,
        attempts,
        requestId: context.requestId,
        reason,
        error: errorMessage(error),
      },
    );
    await audit(
      to === "SIMULATION_FAILED" ? "simulation_failed" : "settlement_failed",
      match,
      context,
      {
        reason,
        severity: "WARNING",
      },
    );
  }

  async function runSimulation(
    match: MatchRecord,
    context: StepContext,
  ): Promise<boolean> {
    const { homeTeam, awayTeam } = match.fixture;
    let run: RunMatchResponse;

    await audit("simulation_started", match, context);

    try {
      // The whole payload: the simulation is given teams and a match id, never a stake, a bettor or an exposure.
      run = await peers.simulation.runMatch(
        {
          matchId: asId<"MatchId">(match.id),
          home: {
            teamId: asId<"TeamId">(homeTeam.id),
            name: homeTeam.name,
            shortName: homeTeam.shortName.slice(0, 8),
            strength:
              pricedStrength(match.homeStrength) ?? toTeamStrength(homeTeam),
          },
          away: {
            teamId: asId<"TeamId">(awayTeam.id),
            name: awayTeam.name,
            shortName: awayTeam.shortName.slice(0, 8),
            strength:
              pricedStrength(match.awayStrength) ?? toTeamStrength(awayTeam),
          },
        },
        context.requestId,
      );

      if (run.status !== "COMPLETED" || run.matchId !== match.id) {
        throw new PeerAnswerError(`the simulation answered ${run.status}`);
      }
    } catch (error) {
      await failStep(
        match,
        "SIMULATION_STARTED",
        "SIMULATION_FAILED",
        error,
        context,
      );

      if (context.throwOnFailure) {
        throw new PeerFailedError(
          ErrorCodes.SIMULATION_FAILED,
          "The simulation service could not run this match.",
        );
      }

      return false;
    }

    const published = await advance(
      match,
      "SIMULATION_STARTED",
      ["RESULT_GENERATED", "EVENTS_PUBLISHED"],
      context,
      {
        homeScore: 0,
        awayScore: 0,
        revealedSequence: 0,
        failureCount: 0,
        failureReason: null,
      },
    );

    if (published) {
      // Names the run, never its outcome: audit entries are readable while the match is still in play.
      await audit("simulation_completed", match, context, {
        after: {
          simulationId: run.simulationId,
          modelVersion: run.modelVersion,
          configurationVersion: run.configurationVersion,
          duplicate: run.duplicate,
        },
      });
    }

    return true;
  }

  async function beginSimulation(
    match: MatchRecord,
    from: MatchLifecycle,
    context: StepContext,
  ): Promise<boolean> {
    const now = clock();
    const started = await advance(
      match,
      from,
      ["SIMULATION_STARTED"],
      context,
      {
        simulationStartedAt: now,
        nextAttemptAt: new Date(now.getTime() + SCHEDULER.LEASE_MS),
      },
    );

    if (started && from === "BETTING_CLOSED") {
      await publishMilestone(
        match,
        "SIMULATION_STARTED",
        `Kick-off: ${label(match)}.`,
        context.requestId,
      );
    }

    return started;
  }

  async function simulateStep(now: Date, context: StepContext): Promise<void> {
    // A run whose answer was lost may have committed all the same. The result exists, so the match moves on.
    const failed = await lifecycle.listDue({
      states: ["SIMULATION_FAILED"],
      now,
      ignoreLease: true,
      limit: SCHEDULER.BATCH_SIZE,
    });
    const committed = new Set(
      await simulation.matchesWithResult(failed.map((match) => match.id)),
    );

    for (const match of failed) {
      if (committed.has(match.id)) {
        await advance(
          match,
          "SIMULATION_FAILED",
          ["RESULT_GENERATED", "EVENTS_PUBLISHED"],
          context,
          {
            homeScore: 0,
            awayScore: 0,
            revealedSequence: 0,
            failureCount: 0,
            failureReason: null,
          },
          "The simulation had committed a result for this match.",
        );
      }
    }

    const kickedOff = await lifecycle.listDue({
      states: ["BETTING_CLOSED"],
      now,
      kickoffBy: now,
      limit: SCHEDULER.BATCH_SIZE,
    });
    const retries = await lifecycle.listDue({
      states: ["SIMULATION_FAILED"],
      now,
      maxFailures: SCHEDULER.MAX_SIMULATION_ATTEMPTS,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of [...kickedOff, ...retries]) {
      if (
        await beginSimulation(match, match.lifecycle as MatchLifecycle, context)
      ) {
        if (!(await runSimulation(match, context))) return;
      }
    }

    // A worker that died mid-call left the match in SIMULATION_STARTED; once its lease lapses the call is made
    // again, which is safe because the simulation answers a second call with the run it already stored.
    const abandoned = await lifecycle.listDue({
      states: ["SIMULATION_STARTED"],
      now,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of abandoned) {
      if (
        await lifecycle.claim(
          match.id,
          "SIMULATION_STARTED",
          now,
          new Date(now.getTime() + SCHEDULER.LEASE_MS),
        )
      ) {
        if (!(await runSimulation(match, context))) return;
      }
    }
  }

  async function revealOne(
    match: MatchRecord,
    now: Date,
    context: StepContext,
  ): Promise<number> {
    const kickoffMs = match.fixture.kickoffAt.getTime();
    const pending = await simulation.listEvents(match.id, {
      after: match.revealedSequence,
      limit: SCHEDULER.REVEAL_BATCH_SIZE,
    });
    let last: (typeof pending)[number] | undefined;

    for (const event of pending) {
      if (revealInstantMs(kickoffMs, event, timing) > now.getTime()) break;

      await publishLive(
        match,
        {
          type: LIVE_EVENT_TYPE[event.type] ?? (event.type as LiveEventType),
          minute: Math.min(120, Math.max(0, event.minute)),
          ...(event.side === null ? {} : { side: event.side }),
          score: { home: event.scoreHome, away: event.scoreAway },
          description: event.description.slice(0, 240),
        },
        context.requestId,
      );
      last = event;
    }

    if (last === undefined) return match.revealedSequence;

    await lifecycle.reveal(match.id, match.revealedSequence, {
      sequence: last.sequence,
      homeScore: last.scoreHome,
      awayScore: last.scoreAway,
    });

    return last.sequence;
  }

  async function finishOne(
    match: MatchRecord,
    revealedSequence: number,
    context: StepContext,
  ): Promise<void> {
    if ((await simulation.countEventsAfter(match.id, revealedSequence)) > 0)
      return;

    const result = await simulation.findResult(match.id);

    if (result === undefined) {
      logger.error("A match in play has no result to finish with", {
        event: "match.resultMissing",
        matchId: match.id,
        requestId: context.requestId,
      });

      return;
    }

    const finished = await advance(
      match,
      "EVENTS_PUBLISHED",
      ["MATCH_FINISHED"],
      context,
      {
        homeScore: result.homeGoals,
        awayScore: result.awayGoals,
        completedAt: clock(),
      },
    );

    if (finished) {
      await peers.odds
        .setMatchMarketsStatus(match.id, "SETTLED", context.requestId)
        .catch((error: unknown) => {
          logger.warn("Markets not marked settled", {
            event: "match.oddsUnavailable",
            code: ErrorCodes.ODDS_UNAVAILABLE,
            matchId: match.id,
            requestId: context.requestId,
            error: errorMessage(error),
          });
        });
    }
  }

  async function revealAndFinishStep(
    now: Date,
    context: StepContext,
  ): Promise<void> {
    const inPlay = await lifecycle.listDue({
      states: ["EVENTS_PUBLISHED"],
      now,
      kickoffBy: now,
      ignoreLease: true,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of inPlay) {
      const revealedSequence = await revealOne(match, now, context);

      if (
        now.getTime() >= fullTimeMs(match.fixture.kickoffAt.getTime(), timing)
      ) {
        await finishOne(match, revealedSequence, context);
      }
    }
  }

  async function runSettlement(
    match: MatchRecord,
    context: StepContext,
  ): Promise<boolean> {
    let outcome: MatchSettlementResult;

    await audit("settlement_started", match, context);

    try {
      outcome = await peers.settlement.settleMatch(match.id, context.requestId);

      if (outcome.status !== "COMPLETED") {
        throw new PeerAnswerError(
          `settlement answered ${outcome.status}, ${String(outcome.betsSettled)} of ${String(outcome.betsTotal)} bets settled`,
        );
      }
    } catch (error) {
      await failStep(
        match,
        "SETTLEMENT_STARTED",
        "SETTLEMENT_FAILED",
        error,
        context,
      );

      return false;
    }

    const settled = await advance(
      match,
      "SETTLEMENT_STARTED",
      ["SETTLEMENT_COMPLETED"],
      context,
      {
        settledAt: clock(),
        failureCount: 0,
        failureReason: null,
      },
    );

    if (settled) {
      await publishMilestone(
        match,
        "SETTLEMENT_COMPLETED",
        `Bets settled: ${label(match)}.`,
        context.requestId,
      );
      await audit("settlement_completed", match, context, {
        after: {
          betsTotal: outcome.betsTotal,
          betsSettled: outcome.betsSettled,
          duplicate: outcome.duplicate,
        },
      });
    }

    return true;
  }

  async function settleStep(now: Date, context: StepContext): Promise<void> {
    const due = await lifecycle.listDue({
      states: ["MATCH_FINISHED", "SETTLEMENT_FAILED"],
      now,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of due) {
      const from = match.lifecycle as MatchLifecycle;
      const started = await advance(
        match,
        from,
        ["SETTLEMENT_STARTED"],
        context,
        {
          nextAttemptAt: new Date(now.getTime() + SCHEDULER.LEASE_MS),
        },
      );

      if (!started) continue;

      if (from === "MATCH_FINISHED") {
        await publishMilestone(
          match,
          "SETTLEMENT_STARTED",
          `Settling bets: ${label(match)}.`,
          context.requestId,
        );
      }

      if (!(await runSettlement(match, context))) return;
    }

    const abandoned = await lifecycle.listDue({
      states: ["SETTLEMENT_STARTED"],
      now,
      limit: SCHEDULER.BATCH_SIZE,
    });

    for (const match of abandoned) {
      if (
        await lifecycle.claim(
          match.id,
          "SETTLEMENT_STARTED",
          now,
          new Date(now.getTime() + SCHEDULER.LEASE_MS),
        )
      ) {
        if (!(await runSettlement(match, context))) return;
      }
    }
  }

  async function runStep(
    name: string,
    requestId: string,
    step: () => Promise<void>,
  ): Promise<void> {
    try {
      await step();
    } catch (error) {
      logger.error("Scheduler step failed", {
        event: "match.schedulerStepFailed",
        step: name,
        requestId,
        error: errorMessage(error),
      });
    }
  }

  async function requireMatch(matchId: string): Promise<MatchRecord> {
    const match = await matches.findMatch(matchId);

    if (match === undefined)
      throw new MatchConflictError("The match no longer exists.");

    return match;
  }

  function adminContext(
    actor: LifecycleActor,
    reason: string,
    requestId: string,
  ): StepContext {
    return { actor, reason, requestId, throwOnFailure: true };
  }

  return {
    tick: async () => {
      const requestId = randomUUID();
      const context: StepContext = {
        actor: SYSTEM_ACTOR,
        requestId,
        throwOnFailure: false,
      };

      liveStreamDown = false;

      await runStep("ensureRounds", requestId, async () =>
        ensureRounds(clock()),
      );
      await runStep("publishMarkets", requestId, async () =>
        publishMarkets(clock(), context),
      );
      await runStep("markActive", requestId, async () =>
        markActive(clock(), context),
      );
      await runStep("closeBetting", requestId, async () =>
        closeBettingStep(clock(), context),
      );
      await runStep("simulate", requestId, async () =>
        simulateStep(clock(), context),
      );
      await runStep("revealAndFinish", requestId, async () =>
        revealAndFinishStep(clock(), context),
      );
      await runStep("settle", requestId, async () =>
        settleStep(clock(), context),
      );
    },

    openBetting: async (matchId, actor, reason, requestId) => {
      const match = await requireMatch(matchId);
      const now = clock();

      if (match.lifecycle !== "FIXTURE_CREATED") {
        throw new MatchConflictError(
          `Betting cannot be opened from ${match.lifecycle}.`,
        );
      }

      if (match.fixture.bettingClosesAt.getTime() <= now.getTime()) {
        throw new MatchConflictError(
          "This match's betting window has already passed.",
        );
      }

      await lifecycle.resetAttempts(match.id, "FIXTURE_CREATED", now);

      if (
        !(await lifecycle.claim(
          match.id,
          "FIXTURE_CREATED",
          now,
          new Date(now.getTime() + SCHEDULER.LEASE_MS),
        ))
      ) {
        throw new MatchConflictError(
          "The scheduler is opening this match right now. Reload and try again.",
        );
      }

      await openOne(match, adminContext(actor, reason, requestId));
    },

    closeBetting: async (matchId, actor, reason, requestId) => {
      const match = await requireMatch(matchId);

      if (
        match.lifecycle !== "BETTING_OPEN" &&
        match.lifecycle !== "BETTING_ACTIVE"
      ) {
        throw new MatchConflictError(
          `Betting cannot be closed from ${match.lifecycle}.`,
        );
      }

      await closeOne(match, adminContext(actor, reason, requestId));
    },

    startSimulation: async (matchId, actor, reason, requestId, mode) => {
      const match = await requireMatch(matchId);
      const now = clock();

      if (await simulation.hasResult(match.id))
        throw new ResultImmutableError(match.id);

      const state = match.lifecycle as MatchLifecycle;
      const leaseLapsed =
        match.nextAttemptAt === null ||
        match.nextAttemptAt.getTime() <= now.getTime();
      const legal =
        state === "SIMULATION_FAILED" ||
        (state === "SIMULATION_STARTED" && leaseLapsed) ||
        (mode === "START" && state === "BETTING_CLOSED");

      if (!legal) {
        throw new MatchConflictError(
          `The simulation cannot be ${mode === "START" ? "started" : "re-run"} from ${state}.`,
        );
      }

      if (match.fixture.kickoffAt.getTime() > now.getTime()) {
        throw new MatchConflictError(
          "This match has not reached its kick-off time.",
        );
      }

      const context = adminContext(actor, reason, requestId);
      const current = { ...match, failureCount: 0 };

      if (state === "SIMULATION_STARTED") {
        if (
          !(await lifecycle.claim(
            match.id,
            state,
            now,
            new Date(now.getTime() + SCHEDULER.LEASE_MS),
          ))
        ) {
          throw new MatchConflictError(
            "This match is being simulated right now.",
          );
        }
      } else {
        await lifecycle.resetAttempts(match.id, state, now);

        if (!(await beginSimulation(current, state, context))) {
          throw new MatchConflictError(
            "The match changed state. Reload and try again.",
          );
        }
      }

      await runSimulation(current, context);
    },

    voidMatch: async (matchId, actor, reason, requestId) => {
      const match = await requireMatch(matchId);
      const context = adminContext(actor, reason, requestId);

      if (
        match.lifecycle === "SETTLEMENT_COMPLETED" ||
        match.lifecycle === "VOIDED"
      ) {
        throw new MatchConflictError(
          `A match cannot be voided from ${match.lifecycle}.`,
        );
      }

      try {
        await peers.odds.setMatchMarketsStatus(match.id, "VOID", requestId);
      } catch (error) {
        logger.warn("Markets not voided", {
          event: "match.oddsUnavailable",
          code: ErrorCodes.ODDS_UNAVAILABLE,
          matchId: match.id,
          requestId,
          error: errorMessage(error),
        });

        throw new PeerFailedError(
          ErrorCodes.ODDS_UNAVAILABLE,
          "The odds service could not void this match's markets.",
        );
      }

      let refund: Awaited<ReturnType<Peers["settlement"]["voidMatch"]>>;

      try {
        refund = await peers.settlement.voidMatch(match.id, reason, requestId);
      } catch (error) {
        logger.error("Void not settled", {
          event: "match.settlementFailed",
          code: ErrorCodes.SETTLEMENT_FAILED,
          matchId: match.id,
          requestId,
          error: errorMessage(error),
        });

        throw new PeerFailedError(
          ErrorCodes.SETTLEMENT_FAILED,
          "The settlement service could not refund this match's bets.",
        );
      }

      const left = await lifecycle.voidMatch(
        match.id,
        actor.label,
        reason,
        clock(),
      );

      if (left === undefined) {
        throw new MatchConflictError(
          "The match was settled or voided while this request was running.",
        );
      }

      logger.info("Match transition", {
        event: "match.transition",
        matchId: match.id,
        from: left,
        to: "VOIDED",
        actor: actor.label,
        requestId,
      });

      await audit("match_cancelled", match, context, {
        after: {
          lifecycle: "VOIDED",
          from: left,
          betsTotal: refund.betsTotal,
          betsRefunded: refund.betsSettled,
        },
        reason,
        severity: "CRITICAL",
      });
    },
  };
}
