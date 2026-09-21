import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runMatchRequestSchema } from "@betng/contracts";
import { createRedisConnection } from "@betng/service-kit";
import { createSchedulerJob } from "../src/jobs/index.js";
import {
  atMinute,
  createFixture,
  createHarness,
  lifecycleOf,
  placeBet,
  TIMELINE,
  transitionsOf,
  testRedisUrl,
} from "./helpers.js";
import type { Harness } from "./helpers.js";

const FULL_WALK = [
  "FIXTURE_CREATED",
  "MARKETS_CREATED",
  "ODDS_PUBLISHED",
  "BETTING_OPEN",
  "BETTING_ACTIVE",
  "BETTING_CLOSED",
  "SIMULATION_STARTED",
  "RESULT_GENERATED",
  "EVENTS_PUBLISHED",
  "MATCH_FINISHED",
  "SETTLEMENT_STARTED",
  "SETTLEMENT_COMPLETED",
];

let harness: Harness;

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

function runsFor(matchId: string): number {
  return harness.peers.calls.runMatch.filter(
    (request) => request.matchId === matchId,
  ).length;
}

describe("match lifecycle", () => {
  it("walks a match from FIXTURE_CREATED to SETTLEMENT_COMPLETED, each transition once", async () => {
    const fixture = await createFixture(harness);
    const { lifecycle } = harness.app;

    await lifecycle.tick();
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("BETTING_OPEN");
    expect(
      harness.peers.calls.publishMarkets.filter((id) => id === fixture.matchId),
    ).toHaveLength(1);

    await placeBet(harness, fixture);
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("BETTING_ACTIVE");

    harness.clock.set(fixture.bettingClosesAt.getTime() - 1);
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("BETTING_ACTIVE");

    harness.clock.set(fixture.bettingClosesAt);
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("BETTING_CLOSED");
    expect(harness.peers.calls.freezeExposure).toContain(fixture.matchId);
    expect(harness.peers.calls.marketsStatus).toContainEqual({
      matchId: fixture.matchId,
      status: "CLOSED",
    });
    expect(runsFor(fixture.matchId)).toBe(0);

    harness.clock.set(fixture.kickoffAt);
    await Promise.all([lifecycle.tick(), lifecycle.tick(), lifecycle.tick()]);
    await lifecycle.tick();
    expect(runsFor(fixture.matchId)).toBe(1);

    const inPlay = await harness.prisma.match.findUniqueOrThrow({
      where: { id: fixture.matchId },
    });

    expect(inPlay).toMatchObject({
      lifecycle: "EVENTS_PUBLISHED",
      status: "IN_PLAY",
      homeScore: 0,
      awayScore: 0,
      revealedSequence: 1,
    });

    harness.clock.set(atMinute(fixture, 10) - 1);
    await lifecycle.tick();
    expect(
      (
        await harness.prisma.match.findUniqueOrThrow({
          where: { id: fixture.matchId },
        })
      ).homeScore,
    ).toBe(0);

    harness.clock.set(atMinute(fixture, 10));
    await lifecycle.tick();
    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      homeScore: 1,
      awayScore: 0,
      revealedSequence: 2,
      status: "IN_PLAY",
    });

    harness.clock.set(atMinute(fixture, 90) - 1);
    await lifecycle.tick();
    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "EVENTS_PUBLISHED",
      homeScore: 2,
      awayScore: 1,
      revealedSequence: TIMELINE.length - 1,
      completedAt: null,
    });

    harness.clock.set(atMinute(fixture, 90));
    await Promise.all([lifecycle.tick(), lifecycle.tick()]);
    await lifecycle.tick();

    const settled = await harness.prisma.match.findUniqueOrThrow({
      where: { id: fixture.matchId },
    });

    expect(settled).toMatchObject({
      lifecycle: "SETTLEMENT_COMPLETED",
      status: "COMPLETED",
      homeScore: 2,
      awayScore: 1,
    });
    expect(settled.completedAt).not.toBeNull();
    expect(await transitionsOf(harness, fixture.matchId)).toEqual(FULL_WALK);
    expect(runsFor(fixture.matchId)).toBe(1);
    expect(
      harness.peers.calls.settleMatch.filter((id) => id === fixture.matchId),
    ).toHaveLength(1);
    expect(harness.peers.calls.marketsStatus).toContainEqual({
      matchId: fixture.matchId,
      status: "SETTLED",
    });

    // Publishing is at-least-once, and the ticks above overlap without the Redis lock: repeats are allowed, gaps are not.
    const stream = harness.peers.calls.events
      .filter((event) => event.matchId === fixture.matchId)
      .map((event) => `${event.type}@${String(event.minute)}`)
      .filter((entry, index, all) => entry !== all[index - 1])
      .map((entry) => entry.split("@")[0]);

    expect(stream).toEqual([
      "BETTING_OPENED",
      "BETTING_CLOSED",
      "SIMULATION_STARTED",
      "KICKOFF",
      "GOAL",
      "CORNER",
      "HALF_TIME",
      "SECOND_HALF",
      "GOAL",
      "YELLOW_CARD",
      "SUBSTITUTION",
      "GOAL",
      "MATCH_FINISHED",
      "SETTLEMENT_STARTED",
      "SETTLEMENT_COMPLETED",
    ]);

    const audits = harness.peers.calls.audits.filter(
      (entry) => entry.entityId === fixture.matchId,
    );

    expect(audits.map((entry) => entry.action)).toEqual([
      "simulation_started",
      "simulation_completed",
      "settlement_started",
      "settlement_completed",
    ]);
    expect(
      audits.every(
        (entry) => entry.actorId === "system" && entry.actorRole === "SYSTEM",
      ),
    ).toBe(true);
    expect(JSON.stringify(audits)).not.toMatch(
      /homeGoals|awayGoals|winner|score/i,
    );
  });

  it("sends the simulation the teams and nothing else", async () => {
    const request = harness.peers.calls.runMatch.at(-1);

    expect(runMatchRequestSchema.safeParse(request).success).toBe(true);
    expect(Object.keys(request ?? {}).sort()).toEqual([
      "away",
      "home",
      "matchId",
    ]);
  });

  it("recovers from a failed simulation with backoff", async () => {
    const fixture = await createFixture(harness);
    const { lifecycle } = harness.app;

    await lifecycle.tick();
    harness.clock.set(fixture.bettingClosesAt);
    await lifecycle.tick();

    harness.peers.fail.simulation.set(fixture.matchId, 1);
    harness.clock.set(fixture.kickoffAt);
    await lifecycle.tick();

    const failed = await harness.prisma.match.findUniqueOrThrow({
      where: { id: fixture.matchId },
    });

    expect(failed).toMatchObject({
      lifecycle: "SIMULATION_FAILED",
      status: "BETTING_CLOSED",
      failureCount: 1,
      homeScore: null,
    });
    expect(failed.failureReason).toContain("SIMULATION_FAILED");
    expect(failed.nextAttemptAt?.getTime()).toBe(
      fixture.kickoffAt.getTime() + 2000,
    );

    await lifecycle.tick();
    expect(runsFor(fixture.matchId)).toBe(1);

    harness.clock.set(fixture.kickoffAt.getTime() + 2000);
    await lifecycle.tick();

    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "EVENTS_PUBLISHED",
      failureCount: 0,
      failureReason: null,
    });
    expect(runsFor(fixture.matchId)).toBe(2);
    expect(await transitionsOf(harness, fixture.matchId)).toEqual([
      "FIXTURE_CREATED",
      "MARKETS_CREATED",
      "ODDS_PUBLISHED",
      "BETTING_OPEN",
      "BETTING_CLOSED",
      "SIMULATION_STARTED",
      "SIMULATION_FAILED",
      "SIMULATION_STARTED",
      "RESULT_GENERATED",
      "EVENTS_PUBLISHED",
    ]);
    expect(
      harness.peers.calls.audits.some(
        (entry) =>
          entry.entityId === fixture.matchId &&
          entry.action === "simulation_failed",
      ),
    ).toBe(true);
  });

  it("stops retrying a simulation after five attempts", async () => {
    const fixture = await createFixture(harness);
    const { lifecycle } = harness.app;

    await lifecycle.tick();
    harness.clock.set(fixture.bettingClosesAt);
    await lifecycle.tick();

    harness.peers.fail.simulation.set(fixture.matchId, 5);

    let now = fixture.kickoffAt.getTime();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      harness.clock.set(now);
      await lifecycle.tick();
      now += 60_000;
    }

    expect(runsFor(fixture.matchId)).toBe(5);

    harness.clock.set(now + 600_000);
    await lifecycle.tick();

    expect(runsFor(fixture.matchId)).toBe(5);
    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "SIMULATION_FAILED",
      failureCount: 5,
    });
  });

  it("recovers from a failed settlement and keeps retrying", async () => {
    const fixture = await createFixture(harness);
    const { lifecycle } = harness.app;

    await lifecycle.tick();
    harness.clock.set(fixture.bettingClosesAt);
    await lifecycle.tick();
    harness.clock.set(fixture.kickoffAt);
    await lifecycle.tick();

    harness.peers.fail.settlement.set(fixture.matchId, 2);
    harness.clock.set(atMinute(fixture, 90));
    await lifecycle.tick();

    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "SETTLEMENT_FAILED",
      status: "COMPLETED",
      failureCount: 1,
    });

    harness.clock.set(atMinute(fixture, 90) + 2000);
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe(
      "SETTLEMENT_FAILED",
    );

    harness.clock.set(atMinute(fixture, 90) + 2000 + 4000);
    await lifecycle.tick();

    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "SETTLEMENT_COMPLETED",
      failureCount: 0,
    });
    expect((await transitionsOf(harness, fixture.matchId)).slice(-6)).toEqual([
      "SETTLEMENT_STARTED",
      "SETTLEMENT_FAILED",
      "SETTLEMENT_STARTED",
      "SETTLEMENT_FAILED",
      "SETTLEMENT_STARTED",
      "SETTLEMENT_COMPLETED",
    ]);
    expect(
      harness.peers.calls.settleMatch.filter((id) => id === fixture.matchId),
    ).toHaveLength(3);
  });

  it("leaves a match unopened while odds is down and opens it when odds returns", async () => {
    const fixture = await createFixture(harness);
    const { lifecycle } = harness.app;

    harness.peers.fail.odds = true;
    await lifecycle.tick();
    expect(
      await harness.prisma.match.findUniqueOrThrow({
        where: { id: fixture.matchId },
      }),
    ).toMatchObject({
      lifecycle: "FIXTURE_CREATED",
      failureCount: 1,
    });

    harness.peers.fail.odds = false;
    harness.clock.set(harness.clock.now().getTime() + 2000);
    await lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("BETTING_OPEN");
  });

  it("keeps three upcoming rounds of ten fixtures for an active league", async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const league = await harness.prisma.league.create({
      data: {
        name: `Rounds ${tag}`,
        code: tag.toUpperCase(),
        slug: `rounds-${tag}`,
        country: "Testland",
        staggerSeconds: 60,
      },
    });
    const ratings = {
      strength: 70,
      attack: 70,
      defence: 70,
      midfield: 70,
      goalkeeping: 70,
      pace: 70,
      finishing: 70,
      possession: 70,
    };

    await harness.prisma.team.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        leagueId: league.id,
        name: `Club ${String(index)}`,
        shortName: `C${String(index)}`,
        code: `T${String(index).padStart(2, "0")}`,
        ...ratings,
      })),
    });

    const now = harness.clock.now();

    try {
      await harness.app.lifecycle.tick();
      await harness.app.lifecycle.tick();

      const fixtures = await harness.prisma.fixture.findMany({
        where: { leagueId: league.id },
        include: { match: true },
        orderBy: [{ matchday: "asc" }],
      });
      const kickoffs = [
        ...new Set(fixtures.map((fixture) => fixture.kickoffAt.getTime())),
      ];

      expect(fixtures).toHaveLength(30);
      expect(fixtures.map((fixture) => fixture.matchday)).toEqual([
        ...Array<number>(10).fill(1),
        ...Array<number>(10).fill(2),
        ...Array<number>(10).fill(3),
      ]);
      expect(
        fixtures.every(
          (fixture) => fixture.season === 1 && fixture.match !== null,
        ),
      ).toBe(true);
      expect(kickoffs).toHaveLength(3);
      expect(kickoffs.every((kickoff) => kickoff % 240_000 === 60_000)).toBe(
        true,
      );
      expect((kickoffs[1] ?? 0) - (kickoffs[0] ?? 0)).toBe(240_000);
      expect(kickoffs[0]).toBeGreaterThanOrEqual(now.getTime() + 10_000);
      expect(
        fixtures.every(
          (fixture) =>
            fixture.kickoffAt.getTime() - fixture.bettingClosesAt.getTime() ===
            10_000,
        ),
      ).toBe(true);
    } finally {
      await harness.retire({ leagueId: league.id });
      await harness.prisma.league.update({
        where: { id: league.id },
        data: { status: "ARCHIVED" },
      });
    }
  });
});

describe("scheduler job", () => {
  it("runs overlapping ticks once and never ticks without the Redis lock", async () => {
    let ticks = 0;
    const redis = createRedisConnection(testRedisUrl());
    const job = createSchedulerJob({
      redis,
      logger: silentLogger as never,
      tick: async () => {
        ticks += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    });

    expect(
      await Promise.all([job.runOnce(), job.runOnce(), job.runOnce()]),
    ).toEqual([true, true, true]);
    expect(ticks).toBe(1);
    await redis.close();

    const unreachable = createRedisConnection("redis://127.0.0.1:1");
    const offline = createSchedulerJob({
      redis: unreachable,
      logger: silentLogger as never,
      tick: async () => {
        ticks += 1;
      },
    });

    expect(await offline.runOnce()).toBe(false);
    expect(ticks).toBe(1);
  });
});
