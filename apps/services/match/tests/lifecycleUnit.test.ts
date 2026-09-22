import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING } from "../src/configs/index.js";
import { SCHEDULER } from "../src/constants/index.js";
import type {
  LiveEventInput,
  MatchRecord,
  NewFixture,
  Peers,
  RoundCursor,
  SimulationEventRow,
  TransitionInput,
} from "../src/interfaces/index.js";
import { createLifecycleService } from "../src/services/lifecycle/index.js";

interface LogEntry {
  readonly level: string;
  readonly message: string;
  readonly meta: Record<string, unknown>;
}

function recordingLogger(entries: LogEntry[]): never {
  const at =
    (level: string) =>
    (message: string, meta: Record<string, unknown> = {}): void => {
      entries.push({ level, message, meta });
    };

  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  } as never;
}

const T0 = Date.parse("2026-09-22T12:00:00.000Z");

function matchRecord(overrides: Partial<MatchRecord> & { kickoffAt: Date }): MatchRecord {
  const { kickoffAt, ...rest } = overrides;

  return {
    id: crypto.randomUUID(),
    fixtureId: crypto.randomUUID(),
    status: "LIVE",
    lifecycle: "EVENTS_PUBLISHED",
    homeScore: 0,
    awayScore: 0,
    revealedSequence: 0,
    failureCount: 0,
    failureReason: null,
    nextAttemptAt: null,
    fixture: {
      kickoffAt,
      bettingClosesAt: new Date(kickoffAt.getTime() - 10_000),
      homeTeam: { name: "Home" },
      awayTeam: { name: "Away" },
      league: { id: crypto.randomUUID() },
    },
    ...rest,
  } as unknown as MatchRecord;
}

interface World {
  readonly matches: MatchRecord[];
  readonly events: SimulationEventRow[];
  readonly transitions: TransitionInput[];
  readonly published: LiveEventInput[];
  readonly resyncs: string[];
  readonly logs: LogEntry[];
  readonly fixtures: NewFixture[][];
  eventDown: boolean;
  publishAttempts: number;
  settleFails: boolean;
  now: number;
  upcoming: number;
  cursor: RoundCursor | undefined;
  leagues: { id: string; status: string; staggerSeconds: number }[];
  teams: { id: string; code: string; status: string }[];
}

function createWorld(): World {
  return {
    matches: [],
    events: [],
    transitions: [],
    published: [],
    resyncs: [],
    logs: [],
    fixtures: [],
    eventDown: false,
    publishAttempts: 0,
    settleFails: false,
    now: T0,
    upcoming: 0,
    cursor: undefined,
    leagues: [],
    teams: [],
  };
}

function serviceFor(world: World): ReturnType<typeof createLifecycleService> {
  const peers = {
    event: {
      publish: async (event: LiveEventInput) => {
        world.publishAttempts += 1;

        if (world.eventDown) throw new Error("event is down");

        world.published.push(event);

        return { sequence: world.published.length };
      },
      resync: async (requestId: string) => {
        world.resyncs.push(requestId);

        return { sequence: world.resyncs.length };
      },
    },
    settlement: {
      settleMatch: async (matchId: string) => {
        if (world.settleFails) throw new Error("settlement is down");

        return { matchId, status: "COMPLETED", betsTotal: 0, betsSettled: 0, duplicate: false };
      },
    },
    identity: { recordAudit: async () => ({ id: crypto.randomUUID() }) },
    odds: { setMatchMarketsStatus: async () => undefined },
  } as unknown as Peers;

  return createLifecycleService({
    catalogue: {
      listLeagues: async () => world.leagues,
      listTeams: async () => world.teams,
    } as never,
    matches: {
      countUpcomingRounds: async () => world.upcoming,
      latestScheduledRound: async () => world.cursor,
      createFixtures: async (fixtures: readonly NewFixture[]) => {
        world.fixtures.push([...fixtures]);
        world.upcoming += 1;

        return fixtures.map(() => crypto.randomUUID());
      },
    } as never,
    lifecycle: {
      listDue: async (query: {
        states: readonly string[];
        now: Date;
        maxFailures?: number;
        ignoreLease?: boolean;
      }) =>
        world.matches.filter(
          (match) =>
            query.states.includes(match.lifecycle) &&
            (query.ignoreLease === true ||
              match.nextAttemptAt === null ||
              match.nextAttemptAt.getTime() <= query.now.getTime()) &&
            (query.maxFailures === undefined || match.failureCount < query.maxFailures),
        ),
      transition: async (input: TransitionInput) => {
        const index = world.matches.findIndex(
          (match) => match.id === input.matchId && match.lifecycle === input.from,
        );
        const current = world.matches[index];
        const target = input.path[input.path.length - 1];

        if (current === undefined || target === undefined) return false;

        const patch = (input.patch ?? {}) as Record<string, unknown>;
        const increment = patch["failureCount"] as { increment?: number } | number | undefined;

        world.matches[index] = {
          ...current,
          lifecycle: target,
          nextAttemptAt: (patch["nextAttemptAt"] as Date | undefined) ?? null,
          failureCount:
            typeof increment === "number"
              ? increment
              : current.failureCount + (increment?.increment ?? 0),
        };
        world.transitions.push(input);

        return true;
      },
      claim: async () => true,
      reveal: async (matchId: string, _from: number, revealed: { sequence: number }) => {
        const index = world.matches.findIndex((match) => match.id === matchId);
        const current = world.matches[index];

        if (current !== undefined) {
          world.matches[index] = { ...current, revealedSequence: revealed.sequence };
        }

        return true;
      },
    } as never,
    simulation: {
      listEvents: async (matchId: string, range: { after: number }) =>
        world.events.filter((event) => event.matchId === matchId && event.sequence > range.after),
      countEventsAfter: async () => 1,
      findResult: async () => undefined,
    } as never,
    betting: { matchesWithBets: async () => [] },
    peers,
    timing: DEFAULT_TIMING,
    clock: () => new Date(world.now),
    logger: recordingLogger(world.logs),
  });
}

function addEvent(world: World, match: MatchRecord): void {
  const sequence = world.events.filter((event) => event.matchId === match.id).length + 1;

  world.events.push({
    id: crypto.randomUUID(),
    matchId: match.id,
    sequence,
    minute: 1,
    type: "CORNER",
    side: "HOME",
    player: null,
    secondaryPlayer: null,
    scoreHome: 0,
    scoreAway: 0,
    description: `Corner ${String(sequence)}`,
  });
}

describe("live stream outage", () => {
  it("retries the event service on a backoff and signals a re-sync when it returns", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);
    const match = matchRecord({ kickoffAt: new Date(T0 - 30_000) });

    world.matches.push(match);
    addEvent(world, match);
    addEvent(world, match);
    world.eventDown = true;

    await lifecycle.tick();
    expect(world.publishAttempts).toBe(1);

    const at = async (offsetMs: number): Promise<void> => {
      world.now = T0 + offsetMs;
      addEvent(world, match);
      await lifecycle.tick();
    };

    await at(1000);
    expect(world.publishAttempts).toBe(1);

    await at(SCHEDULER.LIVE_STREAM_RETRY_BASE_MS);
    expect(world.publishAttempts).toBe(2);

    await at(SCHEDULER.LIVE_STREAM_RETRY_BASE_MS + 3000);
    expect(world.publishAttempts).toBe(2);
    expect(world.resyncs).toHaveLength(0);

    world.eventDown = false;
    await at(SCHEDULER.LIVE_STREAM_RETRY_BASE_MS * 3);
    expect(world.publishAttempts).toBe(3);
    expect(world.resyncs).toHaveLength(1);
    expect(
      world.logs.some((entry) => entry.meta["event"] === "match.liveStreamRecovered"),
    ).toBe(true);

    await at(SCHEDULER.LIVE_STREAM_RETRY_BASE_MS * 3 + 1000);
    expect(world.publishAttempts).toBe(4);
    expect(world.resyncs).toHaveLength(1);
  });

  it("caps the stream backoff", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);
    const match = matchRecord({ kickoffAt: new Date(T0 - 30_000) });

    world.matches.push(match);
    world.eventDown = true;

    for (let tick = 0; tick < 12; tick += 1) {
      addEvent(world, match);
      await lifecycle.tick();
      world.now += SCHEDULER.LIVE_STREAM_RETRY_MAX_MS;
    }

    expect(world.publishAttempts).toBe(12);
  });
});

describe("settlement retries", () => {
  function failedMatch(failureCount: number): MatchRecord {
    return matchRecord({
      kickoffAt: new Date(T0 - 600_000),
      status: "COMPLETED",
      lifecycle: "SETTLEMENT_FAILED",
      failureCount,
    });
  }

  it("backs off between attempts below the cap", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);

    world.settleFails = true;
    world.matches.push(failedMatch(2));
    await lifecycle.tick();

    expect(world.matches[0]).toMatchObject({ lifecycle: "SETTLEMENT_FAILED", failureCount: 3 });
    expect(world.matches[0]?.nextAttemptAt?.getTime()).toBe(T0 + 8000);
    expect(world.logs.some((entry) => entry.meta["event"] === "match.settlementExhausted")).toBe(false);
  });

  it("parks the match for an operator with an alert once the cap is reached, and still picks up a later success", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);

    world.settleFails = true;
    world.matches.push(failedMatch(SCHEDULER.MAX_SETTLEMENT_ATTEMPTS - 1));
    await lifecycle.tick();

    expect(world.matches[0]).toMatchObject({
      lifecycle: "SETTLEMENT_FAILED",
      failureCount: SCHEDULER.MAX_SETTLEMENT_ATTEMPTS,
    });
    expect(world.matches[0]?.nextAttemptAt?.getTime()).toBe(T0 + SCHEDULER.SETTLEMENT_PARKED_RETRY_MS);

    const alert = world.logs.find((entry) => entry.meta["event"] === "match.settlementExhausted");

    expect(alert).toMatchObject({
      level: "error",
      meta: { alert: true, attempts: SCHEDULER.MAX_SETTLEMENT_ATTEMPTS },
    });
    expect(JSON.stringify(alert?.meta)).not.toContain("settlement is down");

    world.now = T0 + 60_000;
    await lifecycle.tick();
    expect(world.transitions).toHaveLength(2);

    world.settleFails = false;
    world.now = T0 + SCHEDULER.SETTLEMENT_PARKED_RETRY_MS;
    await lifecycle.tick();
    expect(world.matches[0]?.lifecycle).toBe("SETTLEMENT_COMPLETED");
  });
});

describe("ensureRounds", () => {
  const teams = ["T1", "T2", "T3", "T4"].map((code) => ({
    id: crypto.randomUUID(),
    code,
    status: "ACTIVE",
  }));

  it("creates the missing upcoming rounds on the league grid and stops at the target", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);

    world.leagues = [{ id: crypto.randomUUID(), status: "ACTIVE", staggerSeconds: 60 }];
    world.teams = [...teams, { id: crypto.randomUUID(), code: "T5", status: "SUSPENDED" }];

    await lifecycle.tick();

    expect(world.fixtures).toHaveLength(DEFAULT_TIMING.upcomingRounds);
    expect(world.fixtures.map((round) => round.map((fixture) => fixture.matchday))).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);

    const kickoffs = world.fixtures.map((round) => round[0]?.kickoffAt.getTime() ?? 0);
    const cycleMs = DEFAULT_TIMING.roundCycleSeconds * 1000;

    expect(kickoffs[0]).toBeGreaterThanOrEqual(
      T0 + (DEFAULT_TIMING.bettingCloseLeadSeconds + SCHEDULER.ROUND_MARGIN_SECONDS) * 1000,
    );
    expect(kickoffs.every((kickoff) => kickoff % cycleMs === 60_000)).toBe(true);
    expect((kickoffs[1] ?? 0) - (kickoffs[0] ?? 0)).toBe(cycleMs);
    expect((kickoffs[2] ?? 0) - (kickoffs[1] ?? 0)).toBe(cycleMs);
    expect(
      world.fixtures
        .flat()
        .every(
          (fixture) =>
            fixture.kickoffAt.getTime() - fixture.bettingClosesAt.getTime() ===
            DEFAULT_TIMING.bettingCloseLeadSeconds * 1000,
        ),
    ).toBe(true);
    expect(
      world.fixtures.every(
        (round) => new Set(round.flatMap((f) => [f.homeTeamId, f.awayTeamId])).size === 4,
      ),
    ).toBe(true);

    await lifecycle.tick();
    expect(world.fixtures).toHaveLength(DEFAULT_TIMING.upcomingRounds);
  });

  it("rolls over into the next season after the last matchday", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);
    const lastKickoff = new Date(T0 + 60_000);

    world.leagues = [{ id: crypto.randomUUID(), status: "ACTIVE", staggerSeconds: 60 }];
    world.teams = teams;
    world.upcoming = DEFAULT_TIMING.upcomingRounds - 1;
    world.cursor = { season: 1, matchday: 6, kickoffAt: lastKickoff };

    await lifecycle.tick();

    expect(world.fixtures).toHaveLength(1);
    expect(world.fixtures[0]?.[0]).toMatchObject({ season: 2, matchday: 1 });
    const kickoff = world.fixtures[0]?.[0]?.kickoffAt.getTime() ?? 0;

    expect(kickoff).toBeGreaterThanOrEqual(lastKickoff.getTime() + DEFAULT_TIMING.roundCycleSeconds * 1000);
    expect(kickoff % (DEFAULT_TIMING.roundCycleSeconds * 1000)).toBe(60_000);
  });

  it("skips inactive leagues and leagues without two active teams", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);

    world.leagues = [{ id: crypto.randomUUID(), status: "SUSPENDED", staggerSeconds: 0 }];
    world.teams = teams;
    await lifecycle.tick();
    expect(world.fixtures).toHaveLength(0);

    world.leagues = [{ id: crypto.randomUUID(), status: "ACTIVE", staggerSeconds: 0 }];
    world.teams = teams.slice(0, 1);
    await lifecycle.tick();
    expect(world.fixtures).toHaveLength(0);
  });
});

describe("tick", () => {
  it("stops before the next step once the scheduler lock is lost", async () => {
    const world = createWorld();
    const lifecycle = serviceFor(world);
    let checks = 0;

    world.leagues = [{ id: crypto.randomUUID(), status: "ACTIVE", staggerSeconds: 60 }];
    world.teams = teams();

    await lifecycle.tick(() => {
      checks += 1;

      return checks === 1;
    });

    expect(checks).toBe(2);
    expect(world.fixtures).toHaveLength(DEFAULT_TIMING.upcomingRounds);
  });

  function teams(): { id: string; code: string; status: string }[] {
    return ["A", "B"].map((code) => ({ id: crypto.randomUUID(), code, status: "ACTIVE" }));
  }
});
