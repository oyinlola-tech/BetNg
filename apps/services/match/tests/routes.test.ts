import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminFixtureSchema,
  adminTeamSchema,
  completedMatchSchema,
  matchEventSchema,
  matchSchema,
  matchStatsSchema,
  standingsSchema,
  topScorerSchema,
} from "@betng/contracts";
import {
  adminHeaders,
  atMinute,
  createFixture,
  createHarness,
  INTERNAL_TOKEN,
  lifecycleOf,
  TIMELINE,
  transitionsOf,
  url,
} from "./helpers.js";
import type { Harness, TestFixture } from "./helpers.js";

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
  await harness.app.server.start();
});

afterAll(async () => {
  await harness.app.server.stop();
  await harness.close();
});

async function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url(path), { headers });

  return { status: response.status, body: await response.json() };
}

async function send(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url(path), { method, headers, body: JSON.stringify(body) });

  return { status: response.status, body: await response.json() };
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

const FIXTURE_ADMIN = adminHeaders(["fixtures:read", "fixtures:operate"]);
const CATALOGUE_ADMIN = adminHeaders(["catalogue:read", "catalogue:write"]);

describe("result secrecy", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createFixture(harness);
  });

  it("has no score, events or stats before kick-off", async () => {
    await harness.app.lifecycle.tick();

    const match = await get(`/matches/${fixture.matchId}`);

    expect(match.status).toBe(200);
    expect(matchSchema.safeParse(match.body).success).toBe(true);
    expect(match.body).toMatchObject({ status: "BETTING_OPEN", lifecycle: "BETTING_OPEN" });
    expect(match.body).not.toHaveProperty("score");
    expect((await get(`/matches/${fixture.matchId}/events`)).body).toEqual({ items: [] });
    expect((await get(`/matches/${fixture.matchId}/stats`)).status).toBe(404);
  });

  it("exposes only revealed information mid-match, to the public and to an admin", async () => {
    await playTo(fixture, atMinute(fixture, 40));

    const match = await get(`/matches/${fixture.matchId}`);

    expect(match.body).toMatchObject({ status: "IN_PLAY", score: { home: 1, away: 0 } });
    expect(match.body).not.toHaveProperty("completedAt");

    const events = (await get(`/matches/${fixture.matchId}/events`)).body as { items: { type: string; minute: number }[] };

    expect(events.items.map((event) => event.type)).toEqual(["KICK_OFF", "GOAL", "CORNER"]);
    expect(events.items.every((event) => event.minute <= 40)).toBe(true);
    expect(events.items.every((event) => matchEventSchema.safeParse(event).success)).toBe(true);

    const stats = await get(`/matches/${fixture.matchId}/stats`);

    expect(stats.status).toBe(200);
    expect(matchStatsSchema.safeParse(stats.body).success).toBe(true);
    expect(stats.body).toMatchObject({
      asOfMinute: 40,
      home: { corners: 0, yellowCards: 0, shots: 6, shotsOnTarget: 2, fouls: 4 },
      away: { corners: 1, yellowCards: 0, shots: 3 },
    });

    const admin = await get(`/admin/matches/${fixture.matchId}`, FIXTURE_ADMIN);

    expect(admin.status).toBe(200);
    expect(adminFixtureSchema.safeParse(admin.body).success).toBe(true);
    expect(admin.body).toMatchObject({ score: { home: 1, away: 0 }, matchStatus: "IN_PLAY", simulationStatus: "COMPLETED" });

    const listed = await get(`/admin/fixtures?leagueId=${fixture.leagueId}&matchday=1`, FIXTURE_ADMIN);

    expect((listed.body as { items: unknown[] }).items).toEqual([expect.objectContaining({ score: { home: 1, away: 0 } })]);

    for (const answer of [match.body, events, stats.body, admin.body, listed.body]) {
      const text = JSON.stringify(answer);

      expect(text).not.toMatch(/C\. Forward|D\. Holder|homeGoals|awayGoals|winner|winningGap/);
      expect(text).not.toContain('"home":2');
    }

    expect((await get(`/results?leagueId=${fixture.leagueId}`)).body).toEqual({ items: [] });
    expect(((await get(`/leagues/${fixture.leagueId}/scorers`)).body as { items: unknown[] }).items).toEqual([
      expect.objectContaining({ player: "A. Striker", goals: 1 }),
    ]);

    const table = (await get(`/leagues/${fixture.leagueId}/standings`)).body as { rows: { played: number }[] };

    expect(table.rows.every((row) => row.played === 0)).toBe(true);
  });

  it("publishes the full record once the match is finished", async () => {
    harness.clock.set(atMinute(fixture, 90));
    await harness.app.lifecycle.tick();

    const match = await get(`/matches/${fixture.matchId}`);

    expect(match.body).toMatchObject({ status: "COMPLETED", score: { home: 2, away: 1 }, lifecycle: "SETTLEMENT_COMPLETED" });

    const events = (await get(`/matches/${fixture.matchId}/events`)).body as { items: unknown[] };

    expect(events.items).toHaveLength(TIMELINE.length);

    expect((await get(`/matches/${fixture.matchId}/stats`)).body).toMatchObject({
      asOfMinute: 90,
      home: { possession: 58, shots: 14, shotsOnTarget: 6, fouls: 10, offsides: 2, corners: 0 },
      away: { possession: 42, shots: 8, shotsOnTarget: 3, fouls: 12, offsides: 4, corners: 1, yellowCards: 1 },
    });

    const results = (await get(`/results?leagueId=${fixture.leagueId}`)).body as { items: unknown[] };

    expect(results.items).toHaveLength(1);
    expect(completedMatchSchema.safeParse(results.items[0]).success).toBe(true);
    expect(results.items[0]).toMatchObject({ result: { homeGoals: 2, awayGoals: 1, winner: "HOME", winningGap: 1 } });

    const standings = await get(`/leagues/${fixture.leagueId}/standings`);

    expect(standingsSchema.safeParse(standings.body).success).toBe(true);
    expect(standings.body).toMatchObject({
      season: 1,
      matchdaysPlayed: 1,
      rows: [
        { position: 1, teamId: fixture.homeTeamId, points: 3, goalDifference: 1, form: ["W"] },
        { position: 2, teamId: fixture.awayTeamId, points: 0, goalDifference: -1, form: ["L"] },
      ],
    });

    const scorers = (await get(`/leagues/${fixture.leagueId}/scorers`)).body as { items: unknown[] };

    expect(scorers.items.every((row) => topScorerSchema.safeParse(row).success)).toBe(true);
    expect(scorers.items).toEqual([
      { player: "A. Striker", teamId: fixture.homeTeamId, goals: 2, assists: 0 },
      { player: "C. Forward", teamId: fixture.awayTeamId, goals: 1, assists: 0 },
    ]);

    const recent = (await get(`/matches?status=COMPLETED&leagueId=${fixture.leagueId}`)).body as { items: unknown[] };

    expect(recent.items).toHaveLength(1);
  });
});

describe("public routes", () => {
  it("lists leagues, teams with a code, fixtures and matches in the default window", async () => {
    const fixture = await createFixture(harness);
    const leagues = (await get("/leagues")).body as { items: { id: string; slug: string; status: string }[] };

    expect(leagues.items.find((league) => league.id === fixture.leagueId)).toMatchObject({ status: "SUSPENDED", sport: "football" });

    const teams = (await get(`/teams?leagueId=${fixture.leagueId}`)).body as { items: unknown[] };

    expect(teams.items).toHaveLength(2);
    expect(teams.items[0]).toMatchObject({ code: "AWY", colors: { primary: "#1F2937" }, strength: 70 });

    const fixtures = (await get(`/fixtures?leagueId=${fixture.leagueId}`)).body as { items: unknown[] };

    expect(fixtures.items).toEqual([expect.objectContaining({ season: 1, matchday: 1, homeTeamId: fixture.homeTeamId })]);

    const later = new Date(fixture.kickoffAt.getTime() + 3_600_000).toISOString();

    expect(((await get(`/fixtures?leagueId=${fixture.leagueId}&from=${later}`)).body as { items: unknown[] }).items).toEqual([]);
    expect(((await get(`/matches?leagueId=${fixture.leagueId}`)).body as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rejects malformed input and unknown ids", async () => {
    expect((await get("/matches?limit=5000")).status).toBe(422);
    expect((await get("/matches?status=WON")).status).toBe(422);
    expect((await get("/teams?leagueId=nope")).status).toBe(422);
    expect((await get("/matches/not-a-uuid")).status).toBe(404);
    expect((await get("/matches/7f1c1f0e-5a53-4c58-9d0b-0d6f4d0a9b11")).status).toBe(404);
    expect((await get("/leagues/7f1c1f0e-5a53-4c58-9d0b-0d6f4d0a9b11/standings")).status).toBe(404);
  });
});

describe("admin routes", () => {
  it("enforces the actor kind, the permission and the internal token", async () => {
    expect((await get("/admin/teams")).status).toBe(401);
    expect(errorCode((await get("/admin/teams", adminHeaders(["fixtures:read"]))).body)).toBe("FORBIDDEN");
    expect((await get("/admin/teams", { ...CATALOGUE_ADMIN, "x-betng-actor-kind": "CUSTOMER" })).status).toBe(403);
    expect((await get("/admin/teams", { ...CATALOGUE_ADMIN, "x-betng-internal-token": `${INTERNAL_TOKEN}x` })).status).toBe(401);
    expect((await send("POST", "/admin/fixtures", {}, adminHeaders(["fixtures:read"]))).status).toBe(403);
    expect((await send("POST", "/admin/matches/7f1c1f0e-5a53-4c58-9d0b-0d6f4d0a9b11/actions", {}, CATALOGUE_ADMIN)).status).toBe(403);
    expect((await get("/admin/teams", CATALOGUE_ADMIN)).status).toBe(200);
  });

  it("creates a league, a team and a fixture", async () => {
    const tag = crypto.randomUUID().slice(0, 6).toUpperCase();
    const league = await send(
      "POST",
      "/admin/leagues",
      { name: `Admin League ${tag}`, code: tag, slug: `admin-${tag.toLowerCase()}`, country: "Testland", status: "SUSPENDED" },
      CATALOGUE_ADMIN,
    );

    expect(league.status).toBe(201);

    const leagueId = (league.body as { id: string }).id;
    const ratings = { attack: 80, midfield: 70, defence: 60, goalkeeper: 65, pace: 75, finishing: 70, form: 2 };
    const teams: string[] = [];

    for (const code of ["AAA", "BBB"]) {
      const team = await send(
        "POST",
        "/admin/teams",
        { leagueId, name: `Team ${code}`, shortName: code, code, ratings },
        CATALOGUE_ADMIN,
      );

      expect(team.status).toBe(201);
      expect(adminTeamSchema.safeParse(team.body).success).toBe(true);
      teams.push((team.body as { id: string }).id);
    }

    expect((await send("POST", "/admin/teams", { leagueId, name: "Dup", shortName: "Dup", code: "AAA", ratings }, CATALOGUE_ADMIN)).status).toBe(409);
    expect((await send("POST", "/admin/teams", { leagueId, name: "X", shortName: "XX", code: "XXX", ratings, strength: 99 }, CATALOGUE_ADMIN)).status).toBe(422);

    const kickoffAt = new Date(harness.clock.now().getTime() + 120_000).toISOString();
    const created = await send(
      "POST",
      "/admin/fixtures",
      { leagueId, homeTeamId: teams[0], awayTeamId: teams[1], kickoffAt },
      FIXTURE_ADMIN,
    );

    expect(created.status).toBe(201);
    expect(adminFixtureSchema.safeParse(created.body).success).toBe(true);
    expect(created.body).toMatchObject({ bettingStatus: "NOT_OPEN", simulationStatus: "QUEUED", settlementStatus: "NOT_DUE", score: { home: 0, away: 0 } });

    const matchId = (created.body as { matchId: string }).matchId;
    const fixture = await harness.prisma.fixture.findFirstOrThrow({ where: { match: { id: matchId } } });

    expect(new Date(kickoffAt).getTime() - fixture.bettingClosesAt.getTime()).toBe(10_000);
    expect(await lifecycleOf(harness, matchId)).toBe("FIXTURE_CREATED");

    const tooSoon = new Date(harness.clock.now().getTime() + 5000).toISOString();

    expect((await send("POST", "/admin/fixtures", { leagueId, homeTeamId: teams[0], awayTeamId: teams[1], kickoffAt: tooSoon }, FIXTURE_ADMIN)).status).toBe(422);
    expect((await send("POST", "/admin/fixtures", { leagueId, homeTeamId: teams[0], awayTeamId: teams[0], kickoffAt }, FIXTURE_ADMIN)).status).toBe(422);
    expect((await send("POST", "/admin/fixtures", { leagueId, homeTeamId: teams[0], awayTeamId: teams[1], kickoffAt, score: { home: 3, away: 0 } }, FIXTURE_ADMIN)).status).toBe(422);
  });

  it("audits a ratings change and rolls it back when the audit cannot be written", async () => {
    const fixture = await createFixture(harness);
    const path = `/admin/teams/${fixture.homeTeamId}`;
    const updated = await send("PATCH", path, { ratings: { attack: 90 } }, CATALOGUE_ADMIN);

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ ratings: { attack: 90, midfield: 70 } });

    const audit = harness.peers.calls.audits.find((entry) => entry.entityId === fixture.homeTeamId);

    expect(audit).toMatchObject({
      action: "team_strength_changed",
      actorId: "0b0f6a52-6f0e-4c53-9a53-1d1c6e0f7a11",
      before: { ratings: { attack: 70 } },
      after: { ratings: { attack: 90 } },
    });

    harness.peers.fail.audit = true;

    const refused = await send("PATCH", path, { ratings: { attack: 10 } }, CATALOGUE_ADMIN);

    harness.peers.fail.audit = false;

    expect(refused.status).toBe(503);
    expect(errorCode(refused.body)).toBe("UPSTREAM_UNAVAILABLE");
    expect((await harness.prisma.team.findUniqueOrThrow({ where: { id: fixture.homeTeamId } })).attack).toBe(90);
    expect((await send("PATCH", path, { ratings: { attack: 120 } }, CATALOGUE_ADMIN)).status).toBe(422);
    expect((await send("PATCH", path, { strength: 99 }, CATALOGUE_ADMIN)).status).toBe(422);
  });

  it("simulates a priced match on the ratings its odds were made from", async () => {
    const fixture = await createFixture(harness);

    await harness.app.lifecycle.tick();
    await send("PATCH", `/admin/teams/${fixture.homeTeamId}`, { ratings: { attack: 95 } }, CATALOGUE_ADMIN);
    harness.clock.set(fixture.bettingClosesAt);
    await harness.app.lifecycle.tick();
    harness.clock.set(fixture.kickoffAt);
    await harness.app.lifecycle.tick();

    const request = harness.peers.calls.runMatch.find((entry) => entry.matchId === fixture.matchId);

    expect(request?.home.strength.attack).toBe(70);
  });

  it("opens and closes betting on request, and refuses an illegal transition", async () => {
    const fixture = await createFixture(harness, 600);
    const path = `/admin/matches/${fixture.matchId}/actions`;

    expect(errorCode((await send("POST", path, { action: "CLOSE_BETTING", reason: "too early" }, FIXTURE_ADMIN)).body)).toBe("CONFLICT");

    const opened = await send("POST", path, { action: "OPEN_BETTING", reason: "open it now" }, FIXTURE_ADMIN);

    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ lifecycle: "BETTING_OPEN", bettingStatus: "OPEN" });
    expect((await send("POST", path, { action: "OPEN_BETTING", reason: "open it again" }, FIXTURE_ADMIN)).status).toBe(409);

    const closed = await send("POST", path, { action: "CLOSE_BETTING", reason: "close it early" }, FIXTURE_ADMIN);

    expect(closed.body).toMatchObject({ lifecycle: "BETTING_CLOSED", bettingStatus: "CLOSED", simulationStatus: "READY" });
    expect(errorCode((await send("POST", path, { action: "START_SIMULATION", reason: "before kick-off" }, FIXTURE_ADMIN)).body)).toBe("CONFLICT");
    expect((await send("POST", path, { action: "SET_SCORE", reason: "no such action" }, FIXTURE_ADMIN)).status).toBe(422);
    expect((await send("POST", path, { action: "VOID_MATCH" }, FIXTURE_ADMIN)).status).toBe(422);

    const transitions = await harness.prisma.matchTransition.findMany({ where: { matchId: fixture.matchId }, orderBy: { sequence: "asc" } });

    expect(transitions.at(-1)).toMatchObject({ toState: "BETTING_CLOSED", actor: "admin:0b0f6a52-6f0e-4c53-9a53-1d1c6e0f7a11", reason: "close it early" });
  });

  it("re-runs a failed simulation, and never one that has a result", async () => {
    const fixture = await createFixture(harness);
    const path = `/admin/matches/${fixture.matchId}/actions`;
    const runs = (): number => harness.peers.calls.runMatch.filter((request) => request.matchId === fixture.matchId).length;

    await harness.app.lifecycle.tick();
    harness.clock.set(fixture.bettingClosesAt);
    await harness.app.lifecycle.tick();
    harness.peers.fail.simulation.set(fixture.matchId, 2);
    harness.clock.set(fixture.kickoffAt);
    await harness.app.lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("SIMULATION_FAILED");

    const failedAgain = await send("POST", path, { action: "RERUN_SIMULATION", reason: "retry now" }, FIXTURE_ADMIN);

    expect(failedAgain.status).toBe(502);
    expect(errorCode(failedAgain.body)).toBe("SIMULATION_FAILED");
    expect(JSON.stringify(failedAgain.body)).not.toContain("simulation is down");

    const rerun = await send("POST", path, { action: "RERUN_SIMULATION", reason: "retry again" }, FIXTURE_ADMIN);

    expect(rerun.status).toBe(200);
    expect(rerun.body).toMatchObject({ lifecycle: "EVENTS_PUBLISHED", simulationStatus: "COMPLETED", score: { home: 0, away: 0 } });
    expect(runs()).toBe(3);

    for (const action of ["RERUN_SIMULATION", "START_SIMULATION"]) {
      const refused = await send("POST", path, { action, reason: "try to re-simulate" }, FIXTURE_ADMIN);

      expect(refused.status).toBe(409);
      expect(errorCode(refused.body)).toBe("RESULT_IMMUTABLE");
    }

    expect(runs()).toBe(3);
  });

  it("voids a match through settlement and audits it", async () => {
    const fixture = await createFixture(harness);
    const path = `/admin/matches/${fixture.matchId}/actions`;

    await harness.app.lifecycle.tick();

    const voided = await send("POST", path, { action: "VOID_MATCH", reason: "fixture entered in error" }, FIXTURE_ADMIN);

    expect(voided.status).toBe(200);
    expect(voided.body).toMatchObject({ lifecycle: "VOIDED", matchStatus: "CANCELLED", settlementStatus: "VOIDED" });
    expect(harness.peers.calls.voidMatch).toContainEqual({ matchId: fixture.matchId, reason: "fixture entered in error" });
    expect(harness.peers.calls.marketsStatus).toContainEqual({ matchId: fixture.matchId, status: "VOID" });
    expect(harness.peers.calls.audits.find((entry) => entry.entityId === fixture.matchId && entry.action === "match_cancelled")).toMatchObject({
      actorId: "0b0f6a52-6f0e-4c53-9a53-1d1c6e0f7a11",
      reason: "fixture entered in error",
      severity: "CRITICAL",
    });
    expect((await transitionsOf(harness, fixture.matchId)).at(-1)).toBe("VOIDED");
    expect((await send("POST", path, { action: "VOID_MATCH", reason: "void it twice" }, FIXTURE_ADMIN)).status).toBe(409);

    harness.clock.set(fixture.kickoffAt.getTime() + 600_000);
    await harness.app.lifecycle.tick();
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("VOIDED");
    expect(harness.peers.calls.runMatch.some((request) => request.matchId === fixture.matchId)).toBe(false);
  });

  it("does not void a settled match", async () => {
    const fixture = await createFixture(harness);

    await playTo(fixture, atMinute(fixture, 90));
    expect(await lifecycleOf(harness, fixture.matchId)).toBe("SETTLEMENT_COMPLETED");

    const refused = await send("POST", `/admin/matches/${fixture.matchId}/actions`, { action: "VOID_MATCH", reason: "too late now" }, FIXTURE_ADMIN);

    expect(refused.status).toBe(409);
    expect(harness.peers.calls.voidMatch.some((call) => call.matchId === fixture.matchId)).toBe(false);
  });

  it("has no route that sets a score or a winner", async () => {
    const paths = harness.app.server.router.list().map((route) => JSON.stringify(route));

    expect(paths.some((route) => /score|winner|result"/i.test(route) && /"(POST|PUT|PATCH|DELETE)"/.test(route))).toBe(false);
  });
});
