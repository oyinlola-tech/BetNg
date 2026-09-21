import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import type { RunMatchRequest, RunMatchResponse } from "@betng/contracts";
import { createApp, loadMatchConfig } from "../src/index.js";
import type { MatchApp } from "../src/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type {
  AuditInput,
  LiveEventInput,
  MarketsStatus,
  Peers,
} from "../src/interfaces/index.js";

const ROOT_ENV = resolve(import.meta.dirname, "../../../../.env");

if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

/** A database of its own, so these tests never collide with the simulation service's migrations in `betng_test`. */
const DATABASE = process.env["MATCH_TEST_DATABASE"] ?? "betng_test_match";

function required(key: string): string {
  const value = process.env[key];

  if (value === undefined || value === "")
    throw new Error(`${key} is not set; see .env.example.`);

  return value;
}

function testUrl(credentials?: {
  readonly user: string;
  readonly password: string;
}): string {
  const target = new URL(required("MATCH_DATABASE_URL"));

  target.pathname = `/${DATABASE}`;

  if (credentials !== undefined) {
    target.username = credentials.user;
    target.password = credentials.password;
  }

  return target.toString();
}

export const MATCH_URL = testUrl();
const SUPERUSER_URL = testUrl({
  user: required("POSTGRES_USER"),
  password: required("POSTGRES_PASSWORD"),
});

export const TEST_PORT = 4101;
export const INTERNAL_TOKEN = "match-test-internal-token-0123456789";

export const TEST_TIMING = Object.freeze({
  secondsPerMinute: 0.5,
  halfTimeSeconds: 2,
  lead: 10,
});

export function createSuperuser(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: SUPERUSER_URL },
      { schema: "match" },
    ),
  });
}

export async function ensurePeerTables(superuser: PrismaClient): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS simulation.match_results (
       match_id uuid PRIMARY KEY, simulation_id uuid NOT NULL, home_goals integer NOT NULL, away_goals integer NOT NULL,
       winner text NOT NULL, winning_gap integer NOT NULL, home_xg numeric(6,3) NOT NULL, away_xg numeric(6,3) NOT NULL,
       seed text NOT NULL, model_version text NOT NULL, configuration_version integer NOT NULL, stats jsonb NOT NULL,
       created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS simulation.match_events (
       id uuid PRIMARY KEY, match_id uuid NOT NULL, sequence integer NOT NULL, minute integer NOT NULL, type text NOT NULL,
       side text NULL, player text NULL, secondary_player text NULL, score_home integer NOT NULL,
       score_away integer NOT NULL, description text NOT NULL, UNIQUE (match_id, sequence))`,
    `CREATE TABLE IF NOT EXISTS betting.bet_selections (
       id uuid PRIMARY KEY, bet_id uuid NOT NULL, match_id uuid NOT NULL, market_id uuid NOT NULL,
       selection_id uuid NOT NULL, league_id uuid NOT NULL, market_type text NOT NULL, selection_code text NOT NULL,
       line numeric(4,1) NULL, odds numeric(8,2) NOT NULL, odds_version integer NOT NULL, market_label text NOT NULL,
       selection_label text NOT NULL, match_label text NOT NULL, league_name text NOT NULL,
       kickoff_at timestamptz NOT NULL, outcome text NOT NULL, result text NULL)`,
    `GRANT USAGE ON SCHEMA simulation, betting TO betng_match`,
    `GRANT SELECT ON simulation.match_results, simulation.match_events, betting.bet_selections TO betng_match`,
  ];

  for (const statement of statements) {
    await superuser.$executeRawUnsafe(statement);
  }
}

export interface TimelineEvent {
  readonly minute: number;
  readonly type: string;
  readonly side?: "HOME" | "AWAY";
  readonly player?: string;
  readonly secondaryPlayer?: string;
  readonly score: readonly [number, number];
}

export const TIMELINE: readonly TimelineEvent[] = [
  { minute: 0, type: "KICK_OFF", score: [0, 0] },
  {
    minute: 10,
    type: "GOAL",
    side: "HOME",
    player: "A. Striker",
    secondaryPlayer: "B. Winger",
    score: [1, 0],
  },
  { minute: 30, type: "CORNER", side: "AWAY", score: [1, 0] },
  { minute: 45, type: "HALF_TIME", score: [1, 0] },
  { minute: 46, type: "SECOND_HALF", score: [1, 0] },
  {
    minute: 70,
    type: "GOAL",
    side: "AWAY",
    player: "C. Forward",
    score: [1, 1],
  },
  {
    minute: 78,
    type: "YELLOW_CARD",
    side: "AWAY",
    player: "D. Holder",
    score: [1, 1],
  },
  {
    minute: 85,
    type: "GOAL",
    side: "HOME",
    player: "A. Striker",
    score: [2, 1],
  },
  { minute: 90, type: "FULL_TIME", score: [2, 1] },
];

export const FINAL_STATS = {
  asOfMinute: 90,
  home: {
    possession: 58,
    shots: 14,
    shotsOnTarget: 6,
    corners: 0,
    fouls: 10,
    offsides: 2,
    yellowCards: 0,
    redCards: 0,
  },
  away: {
    possession: 42,
    shots: 8,
    shotsOnTarget: 3,
    corners: 1,
    fouls: 12,
    offsides: 4,
    yellowCards: 1,
    redCards: 0,
  },
};

export async function commitSimulation(
  superuser: PrismaClient,
  matchId: string,
): Promise<string> {
  const simulationId = randomUUID();

  await superuser.$executeRawUnsafe(
    `INSERT INTO simulation.match_results (match_id, simulation_id, home_goals, away_goals, winner, winning_gap, home_xg,
       away_xg, seed, model_version, configuration_version, stats)
     VALUES ($1::uuid, $2::uuid, 2, 1, 'HOME', 1, 1.8, 1.1, 'test-seed', 'test-1', 1, $3::jsonb)`,
    matchId,
    simulationId,
    JSON.stringify(FINAL_STATS),
  );

  for (const [index, event] of TIMELINE.entries()) {
    await superuser.$executeRawUnsafe(
      `INSERT INTO simulation.match_events (id, match_id, sequence, minute, type, side, player, secondary_player,
         score_home, score_away, description)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      randomUUID(),
      matchId,
      index + 1,
      event.minute,
      event.type,
      event.side ?? null,
      event.player ?? null,
      event.secondaryPlayer ?? null,
      event.score[0],
      event.score[1],
      `${event.type} at ${String(event.minute)}'`,
    );
  }

  return simulationId;
}

export interface FakePeers extends Peers {
  readonly calls: {
    readonly publishMarkets: string[];
    readonly marketsStatus: { matchId: string; status: MarketsStatus }[];
    readonly freezeExposure: string[];
    readonly runMatch: RunMatchRequest[];
    readonly settleMatch: string[];
    readonly voidMatch: { matchId: string; reason: string }[];
    readonly events: LiveEventInput[];
    readonly audits: AuditInput[];
  };
  /** Failures are injected per match: rows left by earlier runs are ticked too and must not consume them. */
  readonly fail: {
    readonly simulation: Map<string, number>;
    readonly settlement: Map<string, number>;
    audit: boolean;
    odds: boolean;
  };
}

export function createFakePeers(superuser: PrismaClient): FakePeers {
  const calls: FakePeers["calls"] = {
    publishMarkets: [],
    marketsStatus: [],
    freezeExposure: [],
    runMatch: [],
    settleMatch: [],
    voidMatch: [],
    events: [],
    audits: [],
  };
  const fail: FakePeers["fail"] = {
    simulation: new Map(),
    settlement: new Map(),
    audit: false,
    odds: false,
  };
  const shouldFail = (
    budget: Map<string, number>,
    matchId: string,
  ): boolean => {
    const left = budget.get(matchId) ?? 0;

    budget.set(matchId, Math.max(0, left - 1));

    return left > 0;
  };

  return {
    calls,
    fail,
    odds: {
      publishMarkets: async (input) => {
        if (fail.odds) throw new Error("odds is down");
        calls.publishMarkets.push(input.matchId);

        return { matchId: input.matchId, markets: 8, oddsVersion: 1 };
      },
      setMatchMarketsStatus: async (matchId, status) => {
        if (fail.odds) throw new Error("odds is down");
        calls.marketsStatus.push({ matchId, status });

        return { updated: 8 };
      },
    },
    simulation: {
      runMatch: async (request): Promise<RunMatchResponse> => {
        calls.runMatch.push(request);

        if (shouldFail(fail.simulation, request.matchId))
          throw new Error("simulation is down");

        const simulationId = await commitSimulation(superuser, request.matchId);

        return {
          simulationId,
          matchId: request.matchId,
          status: "COMPLETED",
          duplicate: false,
          modelVersion: "test-1",
          configurationVersion: 1,
          seed: "test-seed",
          result: { homeGoals: 2, awayGoals: 1, winner: "HOME", winningGap: 1 },
          eventCount: TIMELINE.length,
        };
      },
    },
    risk: {
      freezeExposure: async (matchId) => {
        calls.freezeExposure.push(matchId);

        return { matchId, frozenAt: new Date().toISOString() };
      },
    },
    settlement: {
      settleMatch: async (matchId) => {
        calls.settleMatch.push(matchId);

        if (shouldFail(fail.settlement, matchId))
          throw new Error("settlement is down");

        return {
          matchId,
          status: "COMPLETED",
          betsTotal: 1,
          betsSettled: 1,
          duplicate: false,
        };
      },
      voidMatch: async (matchId, reason) => {
        calls.voidMatch.push({ matchId, reason });

        return {
          matchId,
          status: "COMPLETED",
          betsTotal: 1,
          betsSettled: 1,
          duplicate: false,
        };
      },
    },
    event: {
      publish: async (event) => {
        calls.events.push(event);

        return { sequence: calls.events.length };
      },
    },
    identity: {
      recordAudit: async (entry) => {
        if (fail.audit) throw new Error("identity is down");
        calls.audits.push(entry);

        return { id: randomUUID() };
      },
    },
  };
}

export interface TestClock {
  readonly now: () => Date;
  set(instant: Date | number): void;
}

export function createTestClock(start: Date): TestClock {
  let current = start.getTime();

  return {
    now: () => new Date(current),
    set: (instant) => {
      current = typeof instant === "number" ? instant : instant.getTime();
    },
  };
}

export interface Harness {
  readonly app: MatchApp;
  readonly prisma: PrismaClient;
  readonly superuser: PrismaClient;
  readonly peers: FakePeers;
  readonly clock: TestClock;
  /** Matches this run created; retired on close so later runs do not keep ticking them. */
  readonly createdMatchIds: string[];
  retire(where: {
    readonly matchIds?: readonly string[];
    readonly leagueId?: string;
  }): Promise<void>;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN;

  const superuser = createSuperuser();

  await ensurePeerTables(superuser);

  const peers = createFakePeers(superuser);
  const clock = createTestClock(new Date());
  const config = await loadMatchConfig({
    MATCH_DATABASE_URL: MATCH_URL,
    REDIS_URL: required("REDIS_URL"),
    MATCH_PORT: String(TEST_PORT),
    HOST: "127.0.0.1",
    LOG_LEVEL: "error",
    NODE_ENV: "test",
    SCHEDULER_ENABLED: "false",
    MATCH_SECONDS_PER_MINUTE: String(TEST_TIMING.secondsPerMinute),
    MATCH_HALF_TIME_SECONDS: String(TEST_TIMING.halfTimeSeconds),
    BETTING_CLOSE_LEAD_SECONDS: String(TEST_TIMING.lead),
  });
  const app = createApp(config, { peers, clock: clock.now });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: MATCH_URL }, { schema: "match" }),
  });

  const createdMatchIds: string[] = [];
  const retire: Harness["retire"] = async (where) => {
    await prisma.match.updateMany({
      where: {
        lifecycle: { notIn: ["SETTLEMENT_COMPLETED", "VOIDED"] },
        ...(where.matchIds === undefined
          ? {}
          : { id: { in: [...where.matchIds] } }),
        ...(where.leagueId === undefined
          ? {}
          : { fixture: { leagueId: where.leagueId } }),
      },
      data: { lifecycle: "VOIDED", status: "CANCELLED" },
    });
  };

  return {
    app,
    prisma,
    superuser,
    peers,
    clock,
    createdMatchIds,
    retire,
    close: async () => {
      await retire({ matchIds: createdMatchIds });

      for (const release of app.onShutdown) await release();
      await prisma.$disconnect();
      await superuser.$disconnect();
    },
  };
}

export interface TestFixture {
  readonly leagueId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly matchId: string;
  readonly kickoffAt: Date;
  readonly bettingClosesAt: Date;
}

export async function createFixture(
  harness: Harness,
  inSeconds = 60,
): Promise<TestFixture> {
  const tag = randomUUID().slice(0, 8);
  const now = harness.clock.now();
  const league = await harness.prisma.league.create({
    data: {
      name: `Test League ${tag}`,
      code: tag.toUpperCase(),
      slug: `test-${tag}`,
      country: "Testland",
      status: "SUSPENDED",
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
  const home = await harness.prisma.team.create({
    data: {
      leagueId: league.id,
      name: `Home ${tag}`,
      shortName: "Home",
      code: "HOM",
      ...ratings,
    },
  });
  const away = await harness.prisma.team.create({
    data: {
      leagueId: league.id,
      name: `Away ${tag}`,
      shortName: "Away",
      code: "AWY",
      ...ratings,
    },
  });
  const kickoffAt = new Date(now.getTime() + inSeconds * 1000);
  const bettingClosesAt = new Date(
    kickoffAt.getTime() - TEST_TIMING.lead * 1000,
  );
  const fixture = await harness.prisma.fixture.create({
    data: {
      leagueId: league.id,
      season: 1,
      matchday: 1,
      homeTeamId: home.id,
      awayTeamId: away.id,
      kickoffAt,
      bettingClosesAt,
      source: "ADMIN",
      createdAt: now,
    },
  });
  const match = await harness.prisma.match.create({
    data: { fixtureId: fixture.id, createdAt: now },
  });

  harness.createdMatchIds.push(match.id);

  await harness.prisma.matchTransition.create({
    data: {
      matchId: match.id,
      toState: "FIXTURE_CREATED",
      at: now,
      actor: "test",
    },
  });

  return {
    leagueId: league.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    matchId: match.id,
    kickoffAt,
    bettingClosesAt,
  };
}

export async function placeBet(
  harness: Harness,
  fixture: TestFixture,
): Promise<void> {
  await harness.superuser.$executeRawUnsafe(
    `INSERT INTO betting.bet_selections (id, bet_id, match_id, market_id, selection_id, league_id, market_type,
       selection_code, odds, odds_version, market_label, selection_label, match_label, league_name, kickoff_at, outcome)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'MATCH_RESULT', 'HOME', 1.85, 1, 'Match result',
       'Home', 'Home v Away', 'Test League', $7::timestamptz, 'PENDING')`,
    randomUUID(),
    randomUUID(),
    fixture.matchId,
    randomUUID(),
    randomUUID(),
    fixture.leagueId,
    fixture.kickoffAt.toISOString(),
  );
}

export async function transitionsOf(
  harness: Harness,
  matchId: string,
): Promise<string[]> {
  const rows = await harness.prisma.matchTransition.findMany({
    where: { matchId },
    orderBy: { sequence: "asc" },
  });

  return rows.map((row) => row.toState);
}

export async function lifecycleOf(
  harness: Harness,
  matchId: string,
): Promise<string> {
  return (
    await harness.prisma.match.findUniqueOrThrow({ where: { id: matchId } })
  ).lifecycle;
}

export function atMinute(fixture: TestFixture, minute: number): number {
  const spm = TEST_TIMING.secondsPerMinute * 1000;

  return minute <= 45
    ? fixture.kickoffAt.getTime() + minute * spm
    : fixture.kickoffAt.getTime() +
        45 * spm +
        TEST_TIMING.halfTimeSeconds * 1000 +
        (minute - 45) * spm;
}

export function adminHeaders(
  permissions: readonly string[],
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-betng-internal-token": INTERNAL_TOKEN,
    "x-betng-actor-kind": "ADMIN",
    "x-betng-actor-id": "0b0f6a52-6f0e-4c53-9a53-1d1c6e0f7a11",
    "x-betng-actor-role": "OPERATIONS",
    "x-betng-actor-name": "Test%20Admin",
    "x-betng-permissions": permissions.join(","),
  };
}

export function url(path: string): string {
  return `http://127.0.0.1:${String(TEST_PORT)}/api/v1${path}`;
}
