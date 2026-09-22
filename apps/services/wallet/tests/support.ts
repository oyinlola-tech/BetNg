import { randomUUID } from "node:crypto";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRpcClient, createServiceLogger } from "@betng/service-kit";
import type { RPCClient } from "@zudojs/rpc";
import { createApp } from "../src/app.js";
import type { WalletApp } from "../src/app.js";
import { loadWalletConfig, loadWalletSettings } from "../src/configs/index.js";
import type { WalletSettings } from "../src/configs/index.js";
import { createWalletDatabase, sql } from "../src/databases/index.js";
import type { Sql } from "../src/databases/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { WalletRepository } from "../src/interfaces/index.js";
import { createWalletRepository } from "../src/repositories/index.js";

export const TEST_PORT = 4103;

export const BASE_URL = `http://127.0.0.1:${String(TEST_PORT)}`;

export const INTERNAL_TOKEN = "wallet-integration-test-internal-token";

const HOST = "localhost:55432/betng_test_wallet";

export const WALLET_URL = `postgresql://betng_wallet:betng_wallet_local@${HOST}?schema=wallet`;

const SUPERUSER_URL = `postgresql://betng:betng_local_dev@${HOST}`;

export const WELCOME_GRANT = 10_000_000;

export const OPENING_FLOAT = 50_000_000;

/** The identity tables the wallet reads across schemas, with the columns docs/architecture.md §8 fixes. */
const IDENTITY_DDL: readonly Sql[] = [
  sql`CREATE TABLE IF NOT EXISTS identity.customers (
     id uuid PRIMARY KEY, email text NOT NULL, display_name text NOT NULL, phone text,
     status text NOT NULL, email_verified_at timestamptz, last_active_at timestamptz NOT NULL DEFAULT now(),
     created_at timestamptz NOT NULL DEFAULT now())`,
  sql`CREATE TABLE IF NOT EXISTS identity.admin_users (
     id uuid PRIMARY KEY, email text NOT NULL, name text NOT NULL, role text NOT NULL,
     status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  sql`CREATE TABLE IF NOT EXISTS identity.shops (
     id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL, address text NOT NULL, phone text NOT NULL,
     email text NOT NULL, status text NOT NULL, owner_name text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now())`,
  sql`CREATE TABLE IF NOT EXISTS identity.cashiers (
     id uuid PRIMARY KEY, shop_id uuid NOT NULL, username text NOT NULL, display_name text NOT NULL,
     role text NOT NULL, status text NOT NULL, last_active_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now())`,
  sql`GRANT SELECT ON ALL TABLES IN SCHEMA identity TO betng_reader`,
];

export interface Fixtures {
  readonly superuser: PrismaClient;
  customer(status?: string): Promise<string>;
  admin(): Promise<string>;
  shop(): Promise<string>;
  cashier(shopId: string, displayName: string): Promise<string>;
  close(): Promise<void>;
}

export async function createFixtures(): Promise<Fixtures> {
  const superuser = new PrismaClient({
    adapter: new PrismaPg({ connectionString: SUPERUSER_URL }),
  });

  for (const statement of IDENTITY_DDL) {
    await superuser.$executeRaw(statement);
  }

  return {
    superuser,
    customer: async (status = "ACTIVE") => {
      const id = randomUUID();

      await superuser.$executeRaw`
        INSERT INTO identity.customers (id, email, display_name, status)
        VALUES (${id}::uuid, ${`${id}@example.test`}, ${`Customer ${id.slice(0, 8)}`}, ${status})`;

      return id;
    },
    admin: async () => {
      const id = randomUUID();

      await superuser.$executeRaw`
        INSERT INTO identity.admin_users (id, email, name, role, status)
        VALUES (${id}::uuid, ${`${id}@example.test`}, 'Test Admin', 'SUPER_ADMIN', 'ACTIVE')`;

      return id;
    },
    shop: async () => {
      const id = randomUUID();

      await superuser.$executeRaw`
        INSERT INTO identity.shops (id, code, name, address, phone, email, status, owner_name)
        VALUES (${id}::uuid, ${`T-${id.slice(0, 8)}`}, ${`Shop ${id.slice(0, 8)}`}, '1 Test Road',
                '08000000000', ${`${id}@example.test`}, 'ACTIVE', 'Test Owner')`;

      return id;
    },
    cashier: async (shopId, displayName) => {
      const id = randomUUID();

      await superuser.$executeRaw`
        INSERT INTO identity.cashiers (id, shop_id, username, display_name, role, status)
        VALUES (${id}::uuid, ${shopId}::uuid, ${`c-${id.slice(0, 8)}`}, ${displayName}, 'CASHIER', 'ACTIVE')`;

      return id;
    },
    close: async () => superuser.$disconnect(),
  };
}

const TEST_ENV = Object.freeze({
  NODE_ENV: "test",
  LOG_LEVEL: "fatal",
  HOST: "127.0.0.1",
  WALLET_PORT: String(TEST_PORT),
  WALLET_DATABASE_URL: WALLET_URL,
});

export const TEST_SETTINGS: WalletSettings = loadWalletSettings({ NODE_ENV: "test" });

export interface RunningApp {
  readonly app: WalletApp;
  readonly rpc: RPCClient;
  stop(): Promise<void>;
}

export async function startApp(): Promise<RunningApp> {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN;

  const config = await loadWalletConfig(TEST_ENV);
  const app = createApp(config, TEST_SETTINGS);

  await app.server.start();

  const rpc = createRpcClient({
    name: "wallet",
    url: BASE_URL,
    timeoutMs: 20_000,
  });

  return {
    app,
    rpc,
    stop: async () => {
      await rpc.close();
      await app.server.stop();

      for (const hook of app.onShutdown) {
        await hook();
      }
    },
  };
}

export interface DirectRepository {
  readonly wallets: WalletRepository;
  readonly prisma: PrismaClient;
  close(): Promise<void>;
}

export async function openRepository(): Promise<DirectRepository> {
  const config = await loadWalletConfig(TEST_ENV);
  const { database, prisma } = createWalletDatabase(WALLET_URL);

  return {
    wallets: createWalletRepository(
      prisma,
      TEST_SETTINGS,
      createServiceLogger(config),
    ),
    prisma,
    close: async () => database.close(),
  };
}

export interface ActorInit {
  readonly kind: "CUSTOMER" | "CASHIER" | "ADMIN";
  readonly id: string;
  readonly shopId?: string;
  readonly permissions?: readonly string[];
}

export interface ApiOptions {
  readonly actor?: ActorInit;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly external?: boolean;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

/** `external: true` omits the internal token, as a peer outside the platform would. */
export async function api(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: ApiOptions = {},
): Promise<ApiResponse> {
  const { actor } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.external === true
        ? {}
        : { "x-betng-internal-token": INTERNAL_TOKEN }),
      ...(actor === undefined
        ? {}
        : {
            "x-betng-actor-kind": actor.kind,
            "x-betng-actor-id": actor.id,
            "x-betng-actor-role": actor.kind,
            "x-betng-actor-name": "Test%20Actor",
            "x-betng-permissions": (actor.permissions ?? []).join(","),
            ...(actor.shopId === undefined
              ? {}
              : { "x-betng-shop-id": actor.shopId }),
          }),
      ...options.headers,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text === "" ? undefined : (JSON.parse(text) as unknown),
  };
}

export function errorCode(response: ApiResponse): string | undefined {
  const body = response.body as { error?: { code?: string } } | undefined;

  return body?.error?.code;
}
