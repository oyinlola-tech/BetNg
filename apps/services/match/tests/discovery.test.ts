import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  fixtureSchema,
  headToHeadSchema,
  matchClockSchema,
  matchLineupsSchema,
  matchSchema,
  publicConfigSchema,
  searchResponseSchema,
} from "@betng/contracts";
import type {
  HeadToHead,
  MatchLineups,
  SearchResponse,
} from "@betng/contracts";
import { atMinute, createFixture, createHarness, url } from "./helpers.js";
import type { Harness, TestFixture } from "./helpers.js";

let harness: Harness;

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  harness = await createHarness();
  await harness.app.server.start();
});

afterAll(async () => {
  await harness.superuser.$executeRaw`DROP TABLE IF EXISTS risk.risk_limits`;
  await harness.app.server.stop();
  await harness.close();
});

async function get<T = unknown>(
  path: string,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url(path));

  return { status: response.status, body: (await response.json()) as T };
}

function errorCode(body: unknown): string | undefined {
  return (body as { error?: { code?: string } }).error?.code;
}

async function playTo(fixture: TestFixture, instant: number): Promise<void> {
  const { lifecycle } = harness.app;

  await lifecycle.tick();
  harness.clock.set(fixture.bettingClosesAt);
  await lifecycle.tick();
  harness.clock.set(fixture.kickoffAt);
  await lifecycle.tick();
  harness.clock.set(instant);
  await lifecycle.tick();
}

interface StaticMatch {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly matchday: number;
  readonly kickoffInSeconds: number;
  readonly status: "SCHEDULED" | "IN_PLAY" | "COMPLETED";
  readonly score?: readonly [number, number];
}

const LIFECYCLE = {
  SCHEDULED: "ODDS_PUBLISHED",
  IN_PLAY: "RESULT_GENERATED",
  COMPLETED: "SETTLEMENT_COMPLETED",
} as const;

/** A match row in a fixed state that no scheduler step picks up. */
async function addMatch(leagueId: string, spec: StaticMatch): Promise<string> {
  const now = harness.clock.now();
  const kickoffAt = new Date(now.getTime() + spec.kickoffInSeconds * 1000);
  const fixture = await harness.prisma.fixture.create({
    data: {
      leagueId,
      season: 1,
      matchday: spec.matchday,
      homeTeamId: spec.homeTeamId,
      awayTeamId: spec.awayTeamId,
      kickoffAt,
      bettingClosesAt: new Date(kickoffAt.getTime() - 10_000),
      source: "ADMIN",
      createdAt: now,
    },
  });
  const match = await harness.prisma.match.create({
    data: {
      fixtureId: fixture.id,
      status: spec.status,
      lifecycle: LIFECYCLE[spec.status],
      homeScore: spec.score?.[0] ?? null,
      awayScore: spec.score?.[1] ?? null,
      completedAt: spec.status === "COMPLETED" ? now : null,
      createdAt: now,
    },
  });

  harness.createdMatchIds.push(match.id);

  return match.id;
}

describe("server clock on the match", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture(harness);
  });

  it("is PRE before kick-off, on the match and on each list item", async () => {
    const match = await get<{ clock: unknown }>(`/matches/${fixture.matchId}`);

    expect(matchSchema.safeParse(match.body).success).toBe(true);
    expect(matchClockSchema.safeParse(match.body.clock).success).toBe(true);
    expect(match.body.clock).toEqual({
      period: "PRE",
      minute: 0,
      asOf: harness.clock.now().toISOString(),
      minuteLengthMs: 500,
    });

    const listed = await get<{ items: { clock: unknown }[] }>(
      `/matches?leagueId=${fixture.leagueId}`,
    );

    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]?.clock).toMatchObject({ period: "PRE" });
  });

  it("follows the periods while the match is played and ends at FULL_TIME", async () => {
    const clockAt = async (minute: number, tick = true): Promise<unknown> => {
      harness.clock.set(atMinute(fixture, minute));
      if (tick) await harness.app.lifecycle.tick();

      return (await get<{ clock: unknown }>(`/matches/${fixture.matchId}`)).body
        .clock;
    };

    await playTo(fixture, atMinute(fixture, 40));

    expect(await clockAt(40)).toMatchObject({
      period: "FIRST_HALF",
      minute: 40,
    });

    harness.clock.set(atMinute(fixture, 45) + 1000);
    await harness.app.lifecycle.tick();

    expect(
      (await get<{ clock: unknown }>(`/matches/${fixture.matchId}`)).body.clock,
    ).toMatchObject({ period: "HALF_TIME", minute: 45 });
    expect(await clockAt(70)).toMatchObject({
      period: "SECOND_HALF",
      minute: 70,
    });
    expect(await clockAt(90)).toMatchObject({
      period: "FULL_TIME",
      minute: 90,
    });
  });

  it("stamps every published live event with the clock of its reveal instant", () => {
    const events = harness.peers.calls.events.filter(
      (event) => event.matchId === fixture.matchId,
    );
    const clockOf = (type: string, minute?: number): unknown =>
      events.find(
        (event) =>
          event.type === type &&
          (minute === undefined || event.minute === minute),
      )?.clock;

    expect(events.length).toBeGreaterThan(10);
    expect(
      events.every((event) => matchClockSchema.safeParse(event.clock).success),
    ).toBe(true);
    expect(clockOf("BETTING_OPENED")).toMatchObject({ period: "PRE" });
    expect(clockOf("BETTING_CLOSED")).toMatchObject({ period: "PRE" });
    expect(clockOf("GOAL", 10)).toEqual({
      period: "FIRST_HALF",
      minute: 10,
      asOf: new Date(atMinute(fixture, 10)).toISOString(),
      minuteLengthMs: 500,
    });
    expect(clockOf("HALF_TIME")).toMatchObject({ period: "HALF_TIME" });
    expect(clockOf("GOAL", 85)).toMatchObject({
      period: "SECOND_HALF",
      minute: 85,
    });
    expect(clockOf("KICKOFF")).toMatchObject({
      period: "FIRST_HALF",
      minute: 0,
    });
    expect(clockOf("MATCH_FINISHED")).toMatchObject({
      period: "FULL_TIME",
      minute: 90,
    });
    expect(clockOf("SETTLEMENT_COMPLETED")).toMatchObject({
      period: "FULL_TIME",
    });
  });
});

describe("list order and truncation", () => {
  let base: TestFixture;

  beforeAll(async () => {
    base = await createFixture(harness, 60);

    const teams = { homeTeamId: base.homeTeamId, awayTeamId: base.awayTeamId };

    await addMatch(base.leagueId, {
      ...teams,
      matchday: 3,
      kickoffInSeconds: 180,
      status: "SCHEDULED",
    });
    await addMatch(base.leagueId, {
      ...teams,
      matchday: 2,
      kickoffInSeconds: 120,
      status: "SCHEDULED",
    });

    for (const [matchday, kickoffInSeconds] of [
      [4, -900],
      [5, -300],
      [6, -600],
    ] as const) {
      await addMatch(base.leagueId, {
        ...teams,
        matchday,
        kickoffInSeconds,
        status: "COMPLETED",
        score: [1, 0],
      });
    }
  });

  async function kickoffs(
    path: string,
  ): Promise<{ order: number[]; truncated: unknown }> {
    const { body } = await get<{
      items: { fixtureId?: string; id: string; kickoffAt?: string }[];
      truncated: unknown;
    }>(path);
    const fixtures = await harness.prisma.fixture.findMany({
      where: { leagueId: base.leagueId },
    });
    const byId = new Map(
      fixtures.map((fixture) => [fixture.id, fixture.matchday]),
    );

    return {
      order: body.items.map(
        (item) => byId.get(item.fixtureId ?? item.id) ?? -1,
      ),
      truncated: body.truncated,
    };
  }

  it("lists matches by kick-off ascending and says when the limit cut rows off", async () => {
    const upcoming = `/matches?leagueId=${base.leagueId}&from=${harness.clock.now().toISOString()}`;

    expect(await kickoffs(upcoming)).toEqual({
      order: [1, 2, 3],
      truncated: false,
    });
    expect(await kickoffs(`${upcoming}&limit=3`)).toEqual({
      order: [1, 2, 3],
      truncated: false,
    });
    expect(await kickoffs(`${upcoming}&limit=2`)).toEqual({
      order: [1, 2],
      truncated: true,
    });
  });

  it("lists completed matches by kick-off descending, with or without a window", async () => {
    const completed = `/matches?leagueId=${base.leagueId}&status=COMPLETED`;
    const from = new Date(
      harness.clock.now().getTime() - 3_600_000,
    ).toISOString();

    expect(await kickoffs(completed)).toEqual({
      order: [5, 6, 4],
      truncated: false,
    });
    expect(await kickoffs(`${completed}&from=${from}`)).toEqual({
      order: [5, 6, 4],
      truncated: false,
    });
    expect(await kickoffs(`${completed}&limit=1`)).toEqual({
      order: [5],
      truncated: true,
    });
  });

  it("lists fixtures by kick-off ascending with the same flag", async () => {
    const from = new Date(
      harness.clock.now().getTime() - 3_600_000,
    ).toISOString();
    const window = `/fixtures?leagueId=${base.leagueId}&from=${from}`;
    const listed = await get<{ items: unknown[] }>(window);

    expect(
      listed.body.items.every((item) => fixtureSchema.safeParse(item).success),
    ).toBe(true);
    expect(await kickoffs(window)).toEqual({
      order: [4, 6, 5, 1, 2, 3],
      truncated: false,
    });
    expect(await kickoffs(`${window}&limit=4`)).toEqual({
      order: [4, 6, 5, 1],
      truncated: true,
    });
  });
});

describe("GET /config", () => {
  const createLimitsTable = async (): Promise<number> =>
    harness.superuser.$executeRaw`CREATE TABLE risk.risk_limits (
    version integer PRIMARY KEY, min_stake bigint NOT NULL, max_stake_per_bet bigint NOT NULL,
    max_payout_per_bet bigint NOT NULL, max_liability_per_selection bigint NOT NULL,
    max_liability_per_market bigint NOT NULL, max_liability_per_match bigint NOT NULL,
    active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
    created_by text NOT NULL, reason text NOT NULL)`;

  async function insertLimits(
    version: number,
    minStake: number,
    maxStake: number,
    active: boolean,
  ): Promise<void> {
    await harness.superuser.$executeRaw`
      INSERT INTO risk.risk_limits (version, min_stake, max_stake_per_bet, max_payout_per_bet,
        max_liability_per_selection, max_liability_per_market, max_liability_per_match, active, created_by, reason)
      VALUES (${version}, ${minStake}, ${maxStake}, 1, 1, 1, 1, ${active}, 'test', 'fixture')`;
  }

  it("answers without stake limits when the risk table cannot be read", async () => {
    await harness.superuser.$executeRaw`DROP TABLE IF EXISTS risk.risk_limits`;

    const config = await get(`/config`);

    expect(config.status).toBe(200);
    expect(publicConfigSchema.safeParse(config.body).success).toBe(true);
    expect(config.body).not.toHaveProperty("stakeLimits");
    expect(config.body).toMatchObject({
      currency: { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" },
      features: { liveStream: true, shopTickets: true, cashOut: false },
      competitionTimezone: "UTC",
      maintenance: false,
      timing: {
        secondsPerMinute: 0.5,
        halfTimeSeconds: 2,
        bettingCloseLeadSeconds: 10,
        roundCycleSeconds: 240,
      },
    });
  });

  it("omits them while no row is active, then reads the active row", async () => {
    await createLimitsTable();
    await harness.superuser.$executeRaw`GRANT USAGE ON SCHEMA risk TO betng_match`;
    await harness.superuser.$executeRaw`GRANT SELECT ON risk.risk_limits TO betng_match`;
    await insertLimits(1, 1000, 2_000_000, false);

    expect((await get(`/config`)).body).not.toHaveProperty("stakeLimits");

    await insertLimits(2, 5000, 50_000_000, true);
    await insertLimits(3, 9000, 90_000_000, false);

    const config = await get(`/config`);

    expect(publicConfigSchema.safeParse(config.body).success).toBe(true);
    expect(config.body).toMatchObject({
      stakeLimits: { min: 5000, max: 50_000_000, maxSelections: 20 },
    });
    expect(JSON.stringify(config.body)).not.toMatch(/liabilit|payout/i);
  });
});

describe("GET /matches/:id/head-to-head", () => {
  let base: TestFixture;
  let reversedId: string;
  let ids: string[];

  beforeAll(async () => {
    base = await createFixture(harness);

    const { homeTeamId: a, awayTeamId: b, leagueId } = base;
    const third = await harness.prisma.team.create({
      data: {
        leagueId,
        name: `Third ${randomUUID().slice(0, 8)}`,
        shortName: "Third",
        code: "THD",
        strength: 70,
        attack: 70,
        defence: 70,
        midfield: 70,
        goalkeeping: 70,
        pace: 70,
        finishing: 70,
        possession: 70,
      },
    });
    const meeting = async (
      matchday: number,
      home: string,
      away: string,
      kickoffInSeconds: number,
      score: readonly [number, number],
      status: StaticMatch["status"] = "COMPLETED",
    ): Promise<string> =>
      addMatch(leagueId, {
        homeTeamId: home,
        awayTeamId: away,
        matchday,
        kickoffInSeconds,
        status,
        score,
      });

    ids = [
      await meeting(2, a, b, -600, [2, 1]),
      await meeting(3, b, a, -1200, [3, 0]),
      await meeting(4, b, a, -1800, [0, 1]),
      await meeting(5, a, b, -2400, [1, 1]),
    ];
    reversedId = ids[1] as string;
    await meeting(6, a, b, -30, [4, 0], "IN_PLAY");
    await meeting(7, a, third.id, -900, [5, 5]);
  });

  it("counts completed meetings from this match's home and away sides, newest first", async () => {
    const answer = await get<HeadToHead>(
      `/matches/${base.matchId}/head-to-head`,
    );

    expect(answer.status).toBe(200);
    expect(headToHeadSchema.safeParse(answer.body).success).toBe(true);
    expect(answer.body).toMatchObject({
      matchId: base.matchId,
      played: 4,
      homeWins: 2,
      draws: 1,
      awayWins: 1,
    });
    expect(answer.body.meetings.map((meeting) => meeting.matchId)).toEqual(ids);
    expect(answer.body.meetings[1]).toMatchObject({
      homeTeamId: base.awayTeamId,
      awayTeamId: base.homeTeamId,
      leagueId: base.leagueId,
      score: { home: 3, away: 0 },
    });
  });

  it("never shows a match in play, and leaves out the match itself", async () => {
    const answer = await get<HeadToHead>(
      `/matches/${base.matchId}/head-to-head`,
    );

    expect(JSON.stringify(answer.body)).not.toContain('"home":4');
    expect(
      answer.body.meetings.some((meeting) => meeting.matchId === base.matchId),
    ).toBe(false);

    const reversed = await get<HeadToHead>(
      `/matches/${reversedId}/head-to-head`,
    );

    expect(reversed.body).toMatchObject({
      played: 3,
      homeWins: 0,
      draws: 1,
      awayWins: 2,
    });
    expect(
      reversed.body.meetings.map((meeting) => meeting.matchId),
    ).not.toContain(reversedId);
  });

  it("answers 404 for an unknown or malformed id", async () => {
    expect((await get(`/matches/${randomUUID()}/head-to-head`)).status).toBe(
      404,
    );
    expect((await get(`/matches/1%20OR%201=1/head-to-head`)).status).toBe(404);
  });
});

describe("GET /search", () => {
  let fixture: TestFixture;
  let tag: string;

  const search = async (
    query: string,
  ): Promise<{ status: number; body: SearchResponse }> =>
    get<SearchResponse>(`/search?${query}`);

  beforeAll(async () => {
    fixture = await createFixture(harness);

    const league = await harness.prisma.league.findUniqueOrThrow({
      where: { id: fixture.leagueId },
    });

    tag = league.slug.replace("test-", "");

    for (const [name, code] of [
      [`Per%cent ${tag}`, "PCT"],
      [`Under_score ${tag}`, "USC"],
    ] as const) {
      await harness.prisma.team.create({
        data: {
          leagueId: fixture.leagueId,
          name,
          shortName: code,
          code,
          strength: 70,
          attack: 70,
          defence: 70,
          midfield: 70,
          goalkeeping: 70,
          pace: 70,
          finishing: 70,
          possession: 70,
        },
      });
    }
  });

  it("finds the league, its teams and the fixture in the window", async () => {
    const answer = await search(`q=${tag.toUpperCase()}`);

    expect(answer.status).toBe(200);
    expect(searchResponseSchema.safeParse(answer.body).success).toBe(true);
    expect(answer.body.term).toBe(tag.toUpperCase());
    expect(answer.body.hits.map((hit) => hit.kind)).toEqual([
      "LEAGUE",
      "TEAM",
      "TEAM",
      "TEAM",
      "TEAM",
      "MATCH",
    ]);
    expect(answer.body.hits[0]).toMatchObject({
      id: fixture.leagueId,
      title: `Test League ${tag}`,
      subtitle: "Testland",
    });
    expect(answer.body.hits.at(-1)).toEqual({
      kind: "MATCH",
      id: fixture.matchId,
      title: `Home ${tag} vs Away ${tag}`,
      subtitle: `${tag.toUpperCase()} · Matchday 1`,
      matchId: fixture.matchId,
      leagueId: fixture.leagueId,
    });
  });

  it("matches % and _ literally, never as wildcards", async () => {
    const titles = async (q: string): Promise<string[]> =>
      (await search(`q=${encodeURIComponent(q)}&kinds=TEAM`)).body.hits.map(
        (hit) => hit.title,
      );

    expect(await titles(`Per%cent ${tag}`)).toEqual([`Per%cent ${tag}`]);
    // Scoped to this run's tag: a bare "r%c" is a literal substring of the
    // Per%cent team of every previous run too, so once the table has enough of
    // them the search limit truncates this run's row out of the result.
    expect(await titles(`r%cent ${tag}`)).toContain(`Per%cent ${tag}`);
    expect(await titles(`Per%${tag}`)).toEqual([]);
    expect(await titles(`Under_score ${tag}`)).toEqual([`Under_score ${tag}`]);
    expect(await titles(`Unde__score ${tag}`)).toEqual([]);
    expect(await titles(`%%`)).toEqual([]);
    expect(await titles(`__`)).toEqual([]);
    expect(await titles(`${tag}\\`)).toEqual([]);
    expect(await titles(`'; DROP TABLE "match"."teams"; --`)).toEqual([]);
    expect(await harness.prisma.team.count()).toBeGreaterThan(0);
  });

  it("filters kinds against the allowlist", async () => {
    const kindsOf = async (kinds: string): Promise<string[]> => [
      ...new Set(
        (await search(`q=${tag}&kinds=${kinds}`)).body.hits.map(
          (hit) => hit.kind,
        ),
      ),
    ];

    expect(await kindsOf("TEAM")).toEqual(["TEAM"]);
    expect(await kindsOf("match,league")).toEqual(["LEAGUE", "MATCH"]);
    expect(await kindsOf("TEAM,BOGUS,teams;--")).toEqual(["TEAM"]);
    expect(await kindsOf("PLAYER,MARKET")).toEqual([]);
    expect(await kindsOf("BOGUS")).toEqual([]);
  });

  it("caps the answer at the limit", async () => {
    expect((await search(`q=${tag}&limit=2`)).body.hits).toHaveLength(2);
    expect((await search(`q=Home`)).body.hits.length).toBeLessThanOrEqual(20);
    expect(
      (await search(`q=Home&limit=50`)).body.hits.length,
    ).toBeLessThanOrEqual(50);

    const over = await search(`q=${tag}&limit=51`);

    expect(over.status).toBe(422);
    expect(errorCode(over.body)).toBe("VALIDATION_FAILED");
  });

  it("rejects a term shorter than two characters", async () => {
    for (const query of ["q=a", "q=%20a%20", "q=", "limit=5"]) {
      const answer = await search(query);

      expect(answer.status).toBe(422);
      expect(errorCode(answer.body)).toBe("VALIDATION_FAILED");
    }
  });
});

describe("GET /matches/:id/lineups", () => {
  let fixture: TestFixture;

  const lineups = async (
    matchId: string,
  ): Promise<{ status: number; body: MatchLineups }> =>
    get<MatchLineups>(`/matches/${matchId}/lineups`);

  const substituted = (body: MatchLineups): Record<string, number> =>
    Object.fromEntries(
      [...(body.home?.starting ?? []), ...(body.away?.starting ?? [])]
        .filter((player) => player.substitutedMinute !== undefined)
        .map((player) => [player.name, player.substitutedMinute as number]),
    );

  beforeAll(async () => {
    fixture = await createFixture(harness);
  });

  it("maps the simulation's squads and is unconfirmed before kick-off", async () => {
    const before = harness.peers.calls.getSquads.length;
    const answer = await lineups(fixture.matchId);

    expect(answer.status).toBe(200);
    expect(matchLineupsSchema.safeParse(answer.body).success).toBe(true);
    expect(answer.body).toMatchObject({
      matchId: fixture.matchId,
      confirmed: false,
      home: { teamId: fixture.homeTeamId, side: "HOME", formation: "4-4-2" },
      away: { teamId: fixture.awayTeamId, side: "AWAY", formation: "4-4-2" },
    });

    for (const side of [answer.body.home, answer.body.away]) {
      expect(side?.starting).toHaveLength(11);
      expect(side?.substitutes).toHaveLength(2);
      expect(
        side?.starting.filter((player) => player.captain === true),
      ).toHaveLength(1);
      expect(side?.starting[0]).toMatchObject({ position: "GK", shirt: 1 });
      expect(side?.starting[0]).not.toHaveProperty("captain");
      expect(side?.starting.every((player) => player.grid === undefined)).toBe(
        true,
      );
    }

    expect(substituted(answer.body)).toEqual({});
    const nameOf = async (id: string): Promise<string> =>
      (await harness.prisma.team.findUniqueOrThrow({ where: { id } })).name;

    // Team ids and names only: nothing about the match, its result or its bets reaches the simulation.
    expect(harness.peers.calls.getSquads.slice(before)).toEqual([
      {
        home: {
          teamId: fixture.homeTeamId,
          name: await nameOf(fixture.homeTeamId),
        },
        away: {
          teamId: fixture.awayTeamId,
          name: await nameOf(fixture.awayTeamId),
        },
      },
    ]);
  });

  it("asks the simulation once per team pair while the answer is fresh", async () => {
    const before = harness.peers.calls.getSquads.length;

    await lineups(fixture.matchId);
    await lineups(fixture.matchId);

    expect(harness.peers.calls.getSquads).toHaveLength(before);

    harness.clock.set(harness.clock.now().getTime() + 10 * 60 * 1000 + 1);
    await lineups(fixture.matchId);

    expect(harness.peers.calls.getSquads).toHaveLength(before + 1);
  });

  it("shows a substitution only once its event is revealed", async () => {
    const played = await createFixture(harness);

    await playTo(played, atMinute(played, 79));

    const early = await lineups(played.matchId);

    expect(early.body.confirmed).toBe(true);
    expect(substituted(early.body)).toEqual({});
    expect(JSON.stringify(early.body)).not.toContain("substitutedMinute");

    // The clock alone reveals nothing: the scheduler has not revealed the 80' event yet.
    harness.clock.set(atMinute(played, 82));
    expect(substituted((await lineups(played.matchId)).body)).toEqual({});

    await harness.app.lifecycle.tick();

    const late = await lineups(played.matchId);

    expect(substituted(late.body)).toEqual({ "D. Holder": 80 });
    expect(
      late.body.away?.starting.find((player) => player.name === "D. Holder"),
    ).toMatchObject({ substitutedMinute: 80, position: "FW" });
    expect(matchLineupsSchema.safeParse(late.body).success).toBe(true);
  });

  it("answers 503 when the simulation cannot be reached, and recovers", async () => {
    const other = await createFixture(harness);

    harness.peers.fail.squads = true;

    const down = await lineups(other.matchId);

    expect(down.status).toBe(503);
    expect(errorCode(down.body)).toBe("UPSTREAM_UNAVAILABLE");
    expect(JSON.stringify(down.body)).not.toContain("simulation is down");

    harness.peers.fail.squads = false;

    expect((await lineups(other.matchId)).status).toBe(200);
  });

  it("answers 404 for an unknown match without calling the simulation", async () => {
    const before = harness.peers.calls.getSquads.length;

    expect((await lineups(randomUUID())).status).toBe(404);
    expect(harness.peers.calls.getSquads).toHaveLength(before);
  });
});
