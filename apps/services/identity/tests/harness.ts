import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { ACTOR_HEADERS } from "@betng/service-kit";
import type { AdminRole, ShopRole } from "@betng/contracts";
import { createApp } from "../src/app.js";
import type { IdentityApp } from "../src/app.js";
import { loadIdentityConfig } from "../src/configs/index.js";
import { ADMIN_ROLE_PERMISSIONS, SHOP_ROLE_PERMISSIONS } from "../src/constants/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { AdminUser, Cashier, Customer, Shop } from "../src/generated/prisma/client.js";
import type { IdentityStore, PasswordHasher } from "../src/interfaces/index.js";
import { createIdentityStore } from "../src/repositories/index.js";
import { createPasswordHasher } from "../src/services/security/index.js";
import { encodeBase32 } from "../src/utils/index.js";

export const TEST_PORT = 4110;
export const TEST_DATABASE = "betng_test_identity";
export const INTERNAL_TOKEN = "identity-test-internal-token-0001";
export const PASSWORD = "correct-horse-battery";

/** The minimum a production identity config needs besides the database; placeholder values only. */
export const PRODUCTION_REQUIREMENTS: Readonly<Record<string, string>> = {
  REDIS_URL: "redis://:placeholder-redis-password@localhost:6379",
  IDENTITY_DATA_KEY: Buffer.alloc(32, 7).toString("base64"),
  EMAIL_PROVIDER: "sendgrid",
  SENDGRID_API_KEY: "SG.placeholder-key-for-config-tests",
  EMAIL_FROM: "no-reply@betng.example",
};

const BASE = `http://127.0.0.1:${String(TEST_PORT)}`;

export interface Reply<T = unknown> {
  readonly status: number;
  readonly body: T;
}

export interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export interface ActorInput {
  readonly kind: "CUSTOMER" | "CASHIER" | "ADMIN";
  readonly id?: string;
  readonly role?: string;
  readonly shopId?: string;
  readonly permissions?: readonly string[];
}

export interface CallOptions {
  readonly body?: unknown;
  readonly token?: string;
  readonly actor?: ActorInput;
  readonly headers?: Readonly<Record<string, string>>;
  /** `false` omits the gateway's internal token, as an outside caller would. */
  readonly internal?: boolean;
}

export interface Harness {
  readonly app: IdentityApp;
  readonly prisma: PrismaClient;
  readonly superuser: PrismaClient;
  readonly store: IdentityStore;
  readonly hasher: PasswordHasher;
  readonly logs: string[];
  call<T = unknown>(method: string, path: string, options?: CallOptions): Promise<Reply<T>>;
  rpc<T = unknown>(procedure: string, payload: unknown): Promise<{ success: boolean; result?: T; error?: { code: string } }>;
  issuedCode(email: string): string;
  issuedResetCode(email: string): string;
  makeCustomer(options?: { verified?: boolean }): Promise<Customer>;
  makeAdmin(role: AdminRole, options?: { totp?: boolean }): Promise<AdminUser & { secret?: string }>;
  makeShop(): Promise<Shop>;
  makeCashier(shop: Shop, role: ShopRole, pin?: string): Promise<Cashier>;
  stop(): Promise<void>;
}

function databaseUrl(base: string, user?: { name: string; password: string }): string {
  const url = new URL(base);

  url.pathname = `/${TEST_DATABASE}`;

  if (user !== undefined) {
    url.username = user.name;
    url.password = user.password;
  }

  return url.toString();
}

export const freshEmail = (): string => `${randomUUID()}@example.test`;

export const adminActor = (role: AdminRole, id: string = randomUUID()): ActorInput => ({
  kind: "ADMIN",
  id,
  role,
  permissions: ADMIN_ROLE_PERMISSIONS[role],
});

export const cashierActor = (cashier: Cashier): ActorInput => ({
  kind: "CASHIER",
  id: cashier.id,
  role: cashier.role,
  shopId: cashier.shopId,
  permissions: SHOP_ROLE_PERMISSIONS[cashier.role],
});

export async function startHarness(overrides: Readonly<Record<string, string>> = {}): Promise<Harness> {
  const envFile = resolve(import.meta.dirname, "../../../../.env");

  if (process.env["IDENTITY_DATABASE_URL"] === undefined && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const configured = process.env["IDENTITY_DATABASE_URL"];

  if (configured === undefined) {
    throw new Error("IDENTITY_DATABASE_URL is not set.");
  }

  const url = databaseUrl(configured);

  const superuserUrl = databaseUrl(configured, {
    name: process.env["POSTGRES_USER"] ?? "betng",
    password: process.env["POSTGRES_PASSWORD"] ?? "betng_local_dev",
  });

  // service-kit reads the internal token from the process environment.
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN;

  const logs: string[] = [];
  const write = process.stdout.write.bind(process.stdout);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    logs.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

    return true;
  };

  const config = await loadIdentityConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    IDENTITY_PORT: String(TEST_PORT),
    IDENTITY_DATABASE_URL: url,
    LOG_LEVEL: "info",
    LOG_VERIFICATION_CODES: "true",
    SEED_DEMO_DATA: "true",
    EVENT_SERVICE_URL: "http://127.0.0.1:9",
    ...(process.env["REDIS_URL"] === undefined ? {} : { REDIS_URL: process.env["REDIS_URL"] }),
    ...overrides,
  });

  const app: IdentityApp = createApp(config);

  await app.prepare();
  await app.server.start();

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: "identity" }) });
  const superuser = new PrismaClient({ adapter: new PrismaPg({ connectionString: superuserUrl }) });
  const store = createIdentityStore(prisma);
  const hasher = createPasswordHasher();
  const passwordHash = await hasher.hash(PASSWORD);

  const loggedCode = (event: string, email: string): string => {
    const entry = logs.findLast((line) => line.includes(event) && line.includes(email));
    const code = entry === undefined ? undefined : /"code":\s*"(\d{6})"/u.exec(entry)?.[1];

    if (code === undefined) {
      throw new Error(`No ${event} code was logged for ${email}.`);
    }

    return code;
  };

  return {
    app,
    prisma,
    superuser,
    store,
    hasher,
    logs,

    call: async <T>(method: string, path: string, options: CallOptions = {}): Promise<Reply<T>> => {
      const { actor } = options;

      const response = await fetch(`${BASE}/api/v1${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
          ...(options.internal === false ? {} : { "x-betng-internal-token": INTERNAL_TOKEN }),
          ...(actor === undefined
            ? {}
            : {
                [ACTOR_HEADERS.kind]: actor.kind,
                [ACTOR_HEADERS.id]: actor.id ?? randomUUID(),
                [ACTOR_HEADERS.role]: actor.role ?? actor.kind,
                [ACTOR_HEADERS.name]: encodeURIComponent("Test Actor"),
                ...(actor.shopId === undefined ? {} : { [ACTOR_HEADERS.shopId]: actor.shopId }),
                [ACTOR_HEADERS.permissions]: (actor.permissions ?? []).join(","),
              }),
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });

      const text = await response.text();

      return { status: response.status, body: (text === "" ? undefined : JSON.parse(text)) as T };
    },

    rpc: async (procedure, payload) => {
      const response = await fetch(`${BASE}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-betng-internal-token": INTERNAL_TOKEN },
        body: JSON.stringify({ id: randomUUID(), procedure, payload, metadata: {}, timestamp: Date.now() }),
      });

      return (await response.json()) as never;
    },

    issuedCode: (email) => loggedCode("verification_code_issued", email),

    issuedResetCode: (email) => loggedCode("password_reset_code_issued", email),

    makeCustomer: async ({ verified = true } = {}) =>
      store.customers.create({
        email: freshEmail(),
        displayName: "Test Customer",
        phone: undefined,
        passwordHash,
        ...(verified ? { emailVerifiedAt: new Date() } : {}),
      }),

    makeAdmin: async (role, { totp = false } = {}) => {
      const secret = totp ? encodeBase32(Buffer.from(randomUUID().replaceAll("-", "").slice(0, 20))) : undefined;

      const admin = await store.admins.create({
        email: freshEmail(),
        name: `Test ${role}`,
        role,
        passwordHash,
        totpSecret: secret,
      });

      return { ...admin, ...(secret === undefined ? {} : { secret }) };
    },

    makeShop: async () =>
      store.shops.create({
        code: `T-${randomUUID().slice(0, 13).toUpperCase()}`,
        name: "Test Shop",
        address: "1 Test Road, Lagos",
        phone: "+234 800 000 0000",
        email: freshEmail(),
        ownerName: "Test Owner",
      }),

    makeCashier: async (shop, role, pin = "4711") =>
      store.cashiers.create({
        shopId: shop.id,
        username: `u${randomUUID().slice(0, 8)}`,
        displayName: "Test Cashier",
        role,
        passwordHash,
        pinHash: await hasher.hash(pin),
        credentialsExpireAt: undefined,
      }),

    stop: async () => {
      await app.server.stop();

      for (const release of app.onShutdown) {
        await release();
      }

      await prisma.$disconnect();
      await superuser.$disconnect();
      process.stdout.write = write;
    },
  };
}

/**
 * Rebuilds the wallet and betting tables identity reads (§8 columns plus `wallet.payments`) in identity's own test database.
 * Refuses to run anywhere else, because it drops tables.
 */
export async function resetReadModelFixtures(h: Harness): Promise<void> {
  const su = h.superuser;
  const [where] = await su.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;

  if (where?.name !== TEST_DATABASE) {
    throw new Error("Read-model fixtures only run in the identity test database.");
  }

  await su.$executeRawUnsafe("DROP TABLE IF EXISTS betting.tickets, betting.bets, wallet.wallet_accounts, wallet.payments");
  await su.$executeRawUnsafe(`CREATE TABLE wallet.wallet_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type text NOT NULL, owner_id uuid NOT NULL, balance bigint NOT NULL, UNIQUE (owner_type, owner_id))`);
  await su.$executeRawUnsafe(`CREATE TABLE wallet.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text, user_id uuid NOT NULL, direction text NOT NULL, status text NOT NULL, amount bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz)`);
  await su.$executeRawUnsafe(`CREATE TABLE betting.bets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, channel text NOT NULL, shop_id uuid, cashier_id uuid, stake bigint NOT NULL, status text NOT NULL, payout bigint, placed_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz)`);
  await su.$executeRawUnsafe(`CREATE TABLE betting.tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bet_id uuid NOT NULL UNIQUE, shop_id uuid NOT NULL, cashier_id uuid NOT NULL, status text NOT NULL, paid_at timestamptz, paid_by uuid)`);
  await su.$executeRawUnsafe("GRANT SELECT ON wallet.wallet_accounts, wallet.payments, betting.bets, betting.tickets TO betng_reader");
}

export async function signIn(h: Harness, email: string, userAgent?: string): Promise<{ token: string; expiresAt: string }> {
  const reply = await h.call<{ token: string; expiresAt: string }>("POST", "/auth/login", {
    body: { email, password: PASSWORD },
    ...(userAgent === undefined ? {} : { headers: { "user-agent": userAgent } }),
  });

  if (reply.status !== 200 || reply.body.token === undefined) {
    throw new Error(`Sign-in failed with ${String(reply.status)}.`);
  }

  return reply.body;
}
