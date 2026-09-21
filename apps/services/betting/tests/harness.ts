import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createRedisConnection,
  createServiceLogger,
  internalHeaders,
} from "@betng/service-kit";
import { createRedisMatchLock } from "../src/clients/index.js";
import { createApp, loadBettingConfig } from "../src/index.js";
import type { BettingApp } from "../src/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { BetRepository } from "../src/interfaces/index.js";
import { FakeIdentity, FakeRisk, FakeWallet } from "./fakes.js";
import { FIXTURE_SCHEMA } from "./fixtureSchema.js";

const TEST_DATABASE = "betng_test_betting";
const TEST_PORT = 4102;

const envFile = resolve(import.meta.dirname, "../../../../.env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// Actor headers and /rpc are honoured only with the internal token, so the suite always runs with one.
process.env["INTERNAL_SERVICE_TOKEN"] ??= `test-${crypto.randomUUID()}`;

function inTestDatabase(url: string): string {
  const parsed = new URL(url);

  parsed.pathname = `/${TEST_DATABASE}`;

  return parsed.toString();
}

function superuserUrl(): string {
  const user = process.env["POSTGRES_USER"] ?? "betng";
  const password = process.env["POSTGRES_PASSWORD"] ?? "betng_local_dev";
  const host = process.env["POSTGRES_HOST"] ?? "localhost";
  const port = process.env["POSTGRES_PORT"] ?? "55432";

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${TEST_DATABASE}`;
}

export interface SeededSelection {
  readonly id: string;
  readonly code: string;
  readonly odds: string;
}

export interface SeededMatch {
  readonly matchId: string;
  readonly marketId: string;
  readonly leagueId: string;
  readonly selections: readonly SeededSelection[];
  leg(index?: number): {
    matchId: string;
    marketId: string;
    selectionId: string;
    odds: number;
  };
}

export interface SeedMatchOptions {
  readonly lifecycle?: string;
  readonly closesInMs?: number;
  readonly marketStatus?: string;
  readonly odds?: readonly string[];
}

export interface SeededShop {
  readonly shopId: string;
  readonly cashierId: string;
  readonly shopCode: string;
}

export interface Reply<T = unknown> {
  readonly status: number;
  readonly body: T;
}

export interface Harness {
  readonly risk: FakeRisk;
  readonly wallet: FakeWallet;
  readonly identity: FakeIdentity;
  readonly admin: PrismaClient;
  failNextInsert: boolean;
  lockUnavailable: boolean;
  seedMatch(options?: SeedMatchOptions): Promise<SeededMatch>;
  seedShop(): Promise<SeededShop>;
  customer(id: string): Record<string, string>;
  admin_(permissions?: readonly string[]): Record<string, string>;
  cashier(shop: SeededShop, permissions?: readonly string[]): Record<string, string>;
  call<T = unknown>(
    method: "GET" | "POST",
    path: string,
    options?: { headers?: Record<string, string>; body?: unknown; asGateway?: boolean },
  ): Promise<Reply<T>>;
  rpc<T = unknown>(procedure: string, payload: unknown, asPeer?: boolean): Promise<{
    success: boolean;
    result?: T;
    error?: { code: string; message: string };
  }>;
  stop(): Promise<void>;
}

const ALL_COUNTER_PERMISSIONS = [
  "tickets:sell",
  "tickets:check",
  "tickets:payout",
  "tickets:cancel",
];

const CODES = ["HOME", "DRAW", "AWAY"];

export async function startHarness(): Promise<Harness> {
  const databaseUrl = process.env["BETTING_DATABASE_URL"];

  if (databaseUrl === undefined) {
    throw new Error("BETTING_DATABASE_URL is not set; copy .env.example to .env.");
  }

  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: superuserUrl() }),
  });

  for (const statement of FIXTURE_SCHEMA) {
    await admin.$executeRawUnsafe(statement);
  }

  const risk = new FakeRisk();
  const wallet = new FakeWallet();
  const identity = new FakeIdentity();

  const config = await loadBettingConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    HOST: "127.0.0.1",
    BETTING_PORT: String(TEST_PORT),
    BETTING_DATABASE_URL: inTestDatabase(databaseUrl),
    REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:56379",
  });

  const harness = { failNextInsert: false, lockUnavailable: false };
  const redis = createRedisConnection(config.redisUrl ?? "");
  const redisLock = createRedisMatchLock(redis, createServiceLogger(config));

  const app: BettingApp = createApp(config, {
    risk,
    wallet,
    identity,
    lock: {
      withMatches: async (matchIds, task) =>
        harness.lockUnavailable
          ? { acquired: false }
          : redisLock.withMatches(matchIds, task),
    },
    wrapRepository: (repository): BetRepository => ({
      ...repository,
      insert: async (bet) => {
        if (harness.failNextInsert) {
          harness.failNextInsert = false;
          throw new Error("simulated insert failure");
        }

        return repository.insert(bet);
      },
    }),
  });

  await app.server.start();

  const baseUrl = `http://127.0.0.1:${String(TEST_PORT)}`;

  return Object.assign(harness, {
    risk,
    wallet,
    identity,
    admin,

    seedMatch: async (options: SeedMatchOptions = {}): Promise<SeededMatch> => {
      const leagueId = crypto.randomUUID();
      const homeId = crypto.randomUUID();
      const awayId = crypto.randomUUID();
      const fixtureId = crypto.randomUUID();
      const matchId = crypto.randomUUID();
      const marketId = crypto.randomUUID();
      const tag = leagueId.slice(0, 8);
      const closesAt = new Date(Date.now() + (options.closesInMs ?? 600_000));
      const kickoffAt = new Date(closesAt.getTime() + 10_000);
      const lifecycle = options.lifecycle ?? "BETTING_OPEN";

      await admin.$executeRaw`
        INSERT INTO match.leagues (id, name, code, slug, country, sport, status)
        VALUES (${leagueId}::uuid, ${`League ${tag}`}, ${tag}, ${tag}, 'NG', 'FOOTBALL', 'ACTIVE')`;

      for (const [id, name] of [
        [homeId, `Home ${tag}`],
        [awayId, `Away ${tag}`],
      ] as const) {
        await admin.$executeRaw`
          INSERT INTO match.teams (id, league_id, name, short_name, code, city, stadium, color_primary,
            color_secondary, strength, attack, defence, midfield, goalkeeping, pace, finishing, possession,
            form, home_advantage)
          VALUES (${id}::uuid, ${leagueId}::uuid, ${name}, ${name.slice(0, 3)}, ${id.slice(0, 6)}, 'Lagos',
            'Ground', '#000000', '#ffffff', 70, 70, 70, 70, 70, 70, 70, 70, 0, 5)`;
      }

      await admin.$executeRaw`
        INSERT INTO match.fixtures (id, league_id, season, matchday, home_team_id, away_team_id, kickoff_at,
          betting_closes_at)
        VALUES (${fixtureId}::uuid, ${leagueId}::uuid, '2026', 1, ${homeId}::uuid, ${awayId}::uuid,
          ${kickoffAt}, ${closesAt})`;

      await admin.$executeRaw`
        INSERT INTO match.matches (id, fixture_id, status, lifecycle)
        VALUES (${matchId}::uuid, ${fixtureId}::uuid, 'BETTING_OPEN', ${lifecycle})`;

      await admin.$executeRaw`
        INSERT INTO odds.markets (id, match_id, type, line, status, odds_version)
        VALUES (${marketId}::uuid, ${matchId}::uuid, 'MATCH_RESULT', NULL,
          ${options.marketStatus ?? "OPEN"}, 3)`;

      const selections: SeededSelection[] = [];

      for (const [index, odds] of (options.odds ?? ["2.15", "3.40", "3.10"]).entries()) {
        const id = crypto.randomUUID();
        const code = CODES[index] ?? `S${String(index)}`;

        await admin.$executeRaw`
          INSERT INTO odds.market_selections (id, market_id, match_id, code, label, probability, odds, sort_order)
          VALUES (${id}::uuid, ${marketId}::uuid, ${matchId}::uuid, ${code}, ${code}, 0.333333,
            ${odds}::numeric, ${index})`;

        selections.push({ id, code, odds });
      }

      return {
        matchId,
        marketId,
        leagueId,
        selections,
        leg: (index = 0) => {
          const selection = selections[index];

          if (selection === undefined) {
            throw new Error(`No seeded selection ${String(index)}.`);
          }

          return {
            matchId,
            marketId,
            selectionId: selection.id,
            odds: Number(selection.odds),
          };
        },
      };
    },

    seedShop: async (): Promise<SeededShop> => {
      const shopId = crypto.randomUUID();
      const cashierId = crypto.randomUUID();
      const shopCode = `BNG-${shopId.slice(0, 6).toUpperCase()}`;

      await admin.$executeRaw`
        INSERT INTO identity.shops (id, code, name, address, phone, email, status, owner_name)
        VALUES (${shopId}::uuid, ${shopCode}, 'Test Shop', '1 Test Road', '0800', 'shop@example.test',
          'ACTIVE', 'Owner')`;

      await admin.$executeRaw`
        INSERT INTO identity.cashiers (id, shop_id, username, display_name, role, status)
        VALUES (${cashierId}::uuid, ${shopId}::uuid, ${`c-${cashierId.slice(0, 6)}`}, 'Ada Cashier',
          'CASHIER', 'ACTIVE')`;

      return { shopId, cashierId, shopCode };
    },

    customer: (id: string) => ({
      "x-betng-actor-kind": "CUSTOMER",
      "x-betng-actor-id": id,
      "x-betng-actor-role": "CUSTOMER",
      "x-betng-actor-name": "Test%20Customer",
    }),

    admin_: (permissions: readonly string[] = ["users:read"]) => ({
      "x-betng-actor-kind": "ADMIN",
      "x-betng-actor-id": crypto.randomUUID(),
      "x-betng-actor-role": "SUPER_ADMIN",
      "x-betng-actor-name": "Admin",
      "x-betng-permissions": permissions.join(","),
    }),

    cashier: (
      shop: SeededShop,
      permissions: readonly string[] = ALL_COUNTER_PERMISSIONS,
    ) => ({
      "x-betng-actor-kind": "CASHIER",
      "x-betng-actor-id": shop.cashierId,
      "x-betng-actor-role": "CASHIER",
      "x-betng-actor-name": "Ada%20Cashier",
      "x-betng-shop-id": shop.shopId,
      "x-betng-permissions": permissions.join(","),
    }),

    call: async <T>(
      method: "GET" | "POST",
      path: string,
      options: { headers?: Record<string, string>; body?: unknown; asGateway?: boolean } = {},
    ): Promise<Reply<T>> => {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.asGateway === false ? {} : internalHeaders()),
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });

      return { status: response.status, body: (await response.json()) as T };
    },

    rpc: async <T>(procedure: string, payload: unknown, asPeer = true) => {
      const response = await fetch(`${baseUrl}/rpc`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(asPeer ? internalHeaders() : {}),
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          procedure,
          payload,
          metadata: {},
          timestamp: Date.now(),
        }),
      });

      return (await response.json()) as {
        success: boolean;
        result?: T;
        error?: { code: string; message: string };
      };
    },

    stop: async (): Promise<void> => {
      await app.server.stop();

      for (const task of app.onShutdown) {
        await task();
      }

      await redis.close();
      await admin.$disconnect();
    },
  });
}
