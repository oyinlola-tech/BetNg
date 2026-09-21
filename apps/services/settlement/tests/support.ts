import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp, loadSettlementConfig } from "../src/index.js";
import type { SettlementApp } from "../src/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type {
  ApplySettlementRequest,
  AuditEntry,
  BettingPeer,
  IdentityPeer,
  WalletCreditRequest,
  WalletPeer,
} from "../src/interfaces/index.js";

const TEST_DATABASE = "betng_test_settlement";

export const TEST_PORT = 4104;

const envFile = resolve(import.meta.dirname, "../../../../.env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function serviceUrl(): string {
  const configured = process.env["SETTLEMENT_DATABASE_URL"];

  if (configured === undefined) {
    throw new Error("SETTLEMENT_DATABASE_URL is not set.");
  }

  const url = new URL(configured);

  url.pathname = `/${TEST_DATABASE}`;

  return url.toString();
}

/** The local-development superuser, used only to create and fill the tables other services own. */
function superuserUrl(): string {
  const url = new URL(serviceUrl());

  url.username = process.env["POSTGRES_USER"] ?? "betng";
  url.password = process.env["POSTGRES_PASSWORD"] ?? "betng_local_dev";
  url.search = "";

  return url.toString();
}

const FIXTURE_DDL = [
  `CREATE TABLE IF NOT EXISTS match.matches (
     id uuid PRIMARY KEY, fixture_id uuid UNIQUE, status text NOT NULL, lifecycle text NOT NULL,
     home_score int, away_score int, revealed_sequence int NOT NULL DEFAULT 0, completed_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS simulation.match_results (
     match_id uuid PRIMARY KEY, simulation_id uuid, home_goals int NOT NULL, away_goals int NOT NULL,
     winner text NOT NULL, winning_gap int NOT NULL, home_xg numeric(6,3), away_xg numeric(6,3), seed text,
     model_version text, configuration_version text, stats jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS betting.bets (
     id uuid PRIMARY KEY, user_id uuid, channel text NOT NULL, shop_id uuid, cashier_id uuid,
     stake bigint NOT NULL, currency text NOT NULL DEFAULT 'NGN', total_odds numeric(12,2) NOT NULL,
     potential_payout bigint NOT NULL, status text NOT NULL, payout bigint, risk_decision_id uuid,
     idempotency_key text NOT NULL, placed_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
     cancelled_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS betting.bet_selections (
     id uuid PRIMARY KEY, bet_id uuid NOT NULL, match_id uuid NOT NULL, market_id uuid NOT NULL,
     selection_id uuid NOT NULL, league_id uuid NOT NULL, market_type text NOT NULL,
     selection_code text NOT NULL, line numeric(4,1), odds numeric(8,2) NOT NULL, odds_version int NOT NULL,
     market_label text NOT NULL, selection_label text NOT NULL, match_label text NOT NULL,
     league_name text NOT NULL, kickoff_at timestamptz NOT NULL, outcome text NOT NULL DEFAULT 'PENDING',
     result text)`,
  `CREATE TABLE IF NOT EXISTS betting.tickets (
     id uuid PRIMARY KEY, bet_id uuid UNIQUE NOT NULL, code text UNIQUE NOT NULL, shop_id uuid NOT NULL,
     shop_code text NOT NULL, cashier_id uuid NOT NULL, cashier_name text NOT NULL, customer_name text,
     customer_phone text, status text NOT NULL, paid_at timestamptz, paid_by uuid,
     expires_at timestamptz NOT NULL, cancel_reason text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS identity.shops (
     id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL, address text, phone text, email text,
     status text NOT NULL DEFAULT 'ACTIVE', owner_name text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS identity.customers (
     id uuid PRIMARY KEY, email text NOT NULL, display_name text NOT NULL, phone text,
     status text NOT NULL DEFAULT 'ACTIVE', email_verified_at timestamptz,
     last_active_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now())`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA match, simulation, betting, identity TO betng_reader`,
];

export interface LegFixture {
  readonly matchId: string;
  readonly marketType: string;
  readonly selectionCode: string;
  readonly odds: string;
  readonly line?: string;
}

export interface BetFixture {
  readonly channel?: "ONLINE" | "SHOP";
  readonly userId?: string;
  readonly shopId?: string;
  readonly cashierId?: string;
  readonly stake: bigint;
  readonly status?: string;
  readonly legs: readonly LegFixture[];
}

export interface InsertedBet {
  readonly betId: string;
  readonly selectionIds: readonly string[];
}

export class Fixtures {
  public readonly admin: PrismaClient;

  public constructor() {
    this.admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: superuserUrl() }) });
  }

  public async ensureSchema(): Promise<void> {
    for (const statement of FIXTURE_DDL) {
      await this.admin.$executeRawUnsafe(statement);
    }
  }

  public async match(status = "COMPLETED", lifecycle = "MATCH_FINISHED"): Promise<string> {
    const id = randomUUID();

    await this.admin.$executeRaw`
      INSERT INTO match.matches (id, fixture_id, status, lifecycle)
      VALUES (${id}::uuid, ${randomUUID()}::uuid, ${status}, ${lifecycle})`;

    return id;
  }

  public async setMatch(matchId: string, status: string, lifecycle: string): Promise<void> {
    await this.admin.$executeRaw`
      UPDATE match.matches SET status = ${status}, lifecycle = ${lifecycle} WHERE id = ${matchId}::uuid`;
  }

  public async result(matchId: string, homeGoals: number, awayGoals: number): Promise<void> {
    const winner = homeGoals > awayGoals ? "HOME" : homeGoals < awayGoals ? "AWAY" : "DRAW";

    await this.admin.$executeRaw`
      INSERT INTO simulation.match_results (match_id, simulation_id, home_goals, away_goals, winner, winning_gap)
      VALUES (${matchId}::uuid, ${randomUUID()}::uuid, ${homeGoals}, ${awayGoals}, ${winner},
              ${Math.abs(homeGoals - awayGoals)})`;
  }

  public async completedMatch(homeGoals: number, awayGoals: number): Promise<string> {
    const id = await this.match();

    await this.result(id, homeGoals, awayGoals);

    return id;
  }

  public async shop(name: string): Promise<string> {
    const id = randomUUID();

    await this.admin.$executeRaw`
      INSERT INTO identity.shops (id, code, name) VALUES (${id}::uuid, ${`SHP-${id.slice(0, 8)}`}, ${name})`;

    return id;
  }

  public async customer(displayName: string): Promise<string> {
    const id = randomUUID();

    await this.admin.$executeRaw`
      INSERT INTO identity.customers (id, email, display_name)
      VALUES (${id}::uuid, ${`${id}@example.test`}, ${displayName})`;

    return id;
  }

  public async bet(fixture: BetFixture): Promise<InsertedBet> {
    const betId = randomUUID();
    const channel = fixture.channel ?? "ONLINE";
    const userId = channel === "ONLINE" ? (fixture.userId ?? randomUUID()) : null;
    const shopId = channel === "SHOP" ? (fixture.shopId ?? randomUUID()) : null;
    const cashierId = channel === "SHOP" ? (fixture.cashierId ?? randomUUID()) : null;

    await this.admin.$executeRaw`
      INSERT INTO betting.bets
        (id, user_id, channel, shop_id, cashier_id, stake, total_odds, potential_payout, status, idempotency_key)
      VALUES
        (${betId}::uuid, ${userId}::uuid, ${channel}, ${shopId}::uuid, ${cashierId}::uuid, ${fixture.stake},
         1.00, ${fixture.stake}, ${fixture.status ?? "PENDING"}, ${randomUUID()})`;

    const selectionIds: string[] = [];

    for (const [index, leg] of fixture.legs.entries()) {
      const selectionId = randomUUID();

      selectionIds.push(selectionId);

      await this.admin.$executeRaw`
        INSERT INTO betting.bet_selections
          (id, bet_id, match_id, market_id, selection_id, league_id, market_type, selection_code, line, odds,
           odds_version, market_label, selection_label, match_label, league_name, kickoff_at)
        VALUES
          (${randomUUID()}::uuid, ${betId}::uuid, ${leg.matchId}::uuid, ${randomUUID()}::uuid,
           ${selectionId}::uuid, ${randomUUID()}::uuid, ${leg.marketType}, ${leg.selectionCode},
           ${leg.line ?? null}::numeric, ${leg.odds}::numeric, 1, ${leg.marketType}, ${leg.selectionCode},
           ${`Match ${leg.matchId.slice(0, 4)}`}, 'Test League',
           now() + make_interval(secs => ${index}))`;
    }

    return { betId, selectionIds };
  }

  public async close(): Promise<void> {
    await this.admin.$disconnect();
  }
}

/** Fakes of the three RPC peers. Every call is recorded; the wallet is idempotent by key like the real one. */
export class FakePeers {
  public readonly bettingCalls: ApplySettlementRequest[] = [];
  public readonly walletCalls: WalletCreditRequest[] = [];
  public readonly credited = new Map<string, WalletCreditRequest>();
  public readonly audits: AuditEntry[] = [];

  public walletFailure: Error | undefined;
  public bettingFailure: Error | undefined;
  public auditFailure: Error | undefined;

  public readonly betting: BettingPeer = {
    applySettlement: async (request) => {
      if (this.bettingFailure !== undefined) {
        throw this.bettingFailure;
      }

      this.bettingCalls.push(request);

      return { betId: request.betId, status: request.outcome };
    },
  };

  public readonly wallet: WalletPeer = {
    credit: async (request) => {
      this.walletCalls.push(request);

      if (this.walletFailure !== undefined) {
        throw this.walletFailure;
      }

      const duplicate = this.credited.has(request.idempotencyKey);

      if (!duplicate) {
        this.credited.set(request.idempotencyKey, request);
      }

      return { duplicate };
    },
  };

  public readonly identity: IdentityPeer = {
    recordAudit: async (entry) => {
      if (this.auditFailure !== undefined) {
        throw this.auditFailure;
      }

      this.audits.push(entry);

      return { id: randomUUID() };
    },
  };

  public walletCallsFor(betId: string): WalletCreditRequest[] {
    return this.walletCalls.filter((call) => call.idempotencyKey.endsWith(`:${betId}`));
  }
}

export interface Harness {
  readonly app: SettlementApp;
  readonly peers: FakePeers;
  readonly fixtures: Fixtures;
  readonly close: () => Promise<void>;
}

export async function createHarness(peers: FakePeers = new FakePeers()): Promise<Harness> {
  const fixtures = new Fixtures();

  await fixtures.ensureSchema();

  const config = await loadSettlementConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    SETTLEMENT_PORT: String(TEST_PORT),
    LOG_LEVEL: "fatal",
    SETTLEMENT_DATABASE_URL: serviceUrl(),
    SETTLEMENT_RETRY_ENABLED: "false",
    DEFAULT_SHOP_SHARE_PERCENT: "20",
  });

  const app = createApp(config, peers);

  await app.prepare();

  return {
    app,
    peers,
    fixtures,
    close: async () => {
      for (const release of app.onShutdown) {
        await release();
      }

      await fixtures.close();
    },
  };
}

export const SYSTEM = Object.freeze({ actorId: "system", actorRole: "SYSTEM", requestId: "test" });
