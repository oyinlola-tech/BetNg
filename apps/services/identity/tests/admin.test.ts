import { randomUUID } from "node:crypto";
import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminShopSummary,
  AuditLogEntry,
  Page,
  PlatformSettings,
} from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminActor, freshEmail, startHarness, TEST_DATABASE } from "./harness.js";
import type { ActorInput, ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 });

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

const ID = "00000000-0000-4000-8000-000000000000";

const ADMIN_ROUTES: readonly (readonly [string, string, string])[] = [
  ["GET", "/admin/users", "users:read"],
  ["POST", `/admin/users/${ID}/status`, "users:write"],
  ["GET", "/admin/shops", "shops:read"],
  ["GET", `/admin/shops/${ID}`, "shops:read"],
  ["POST", "/admin/shops", "shops:write"],
  ["PATCH", `/admin/shops/${ID}`, "shops:write"],
  ["POST", `/admin/shops/${ID}/status`, "shops:write"],
  ["GET", `/admin/shops/${ID}/cashiers`, "shops:read"],
  ["POST", `/admin/shops/${ID}/cashiers`, "cashiers:write"],
  ["POST", `/admin/shops/${ID}/cashiers/${ID}/status`, "cashiers:write"],
  ["POST", `/admin/shops/${ID}/cashiers/${ID}/reset-credentials`, "cashiers:write"],
  ["GET", "/admin/audit", "audit:read"],
  ["GET", "/admin/settings", "settings:read"],
  ["PATCH", "/admin/settings", "settings:write"],
];

const shopBody = (): Record<string, string> => ({
  code: `a-${randomUUID().slice(0, 12)}`,
  name: "BetNG Test Branch",
  address: "5 Marina Road, Lagos",
  phone: "+234 801 000 0000",
  email: freshEmail(),
  ownerName: "Test Owner",
});

describe("admin route authorisation", () => {
  it.each(ADMIN_ROUTES)("%s %s requires an ADMIN actor holding %s", async (method, path, permission) => {
    const everythingElse = ADMIN_ROUTES.map((route) => route[2]).filter((other) => other !== permission);
    const body = method === "GET" ? undefined : {};

    const refusals: readonly [ActorInput | undefined, number][] = [
      [undefined, 401],
      [{ kind: "CUSTOMER", permissions: [permission] }, 403],
      [{ kind: "CASHIER", role: "OWNER", shopId: ID, permissions: [permission] }, 403],
      [{ kind: "ADMIN", role: "SUPPORT", permissions: everythingElse }, 403],
    ];

    for (const [actor, status] of refusals) {
      const reply = await h.call<ErrorBody>(method, path, { ...(actor === undefined ? {} : { actor }), ...(body === undefined ? {} : { body }) });

      expect(reply.status).toBe(status);
      expect(reply.body.error.code).toBe(status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN");
    }

    const outside = await h.call<ErrorBody>(method, path, {
      actor: { kind: "ADMIN", role: "SUPER_ADMIN", permissions: [permission] },
      internal: false,
      ...(body === undefined ? {} : { body }),
    });

    expect(outside.status).toBe(401);
  });

  it("SUPPORT reads shops but cannot write them", async () => {
    const support = adminActor("SUPPORT");
    const shop = await h.makeShop();

    expect((await h.call("GET", "/admin/shops", { actor: support })).status).toBe(200);
    expect((await h.call("POST", "/admin/shops", { actor: support, body: shopBody() })).status).toBe(403);
    expect((await h.call("PATCH", `/admin/shops/${shop.id}`, { actor: support, body: { name: "Renamed" } })).status).toBe(403);
    expect((await h.call("POST", `/admin/shops/${shop.id}/status`, { actor: support, body: { status: "SUSPENDED", reason: "No reason" } })).status).toBe(403);
    expect((await h.store.shops.findById(shop.id))?.name).toBe("Test Shop");
  });
});

describe("shops", () => {
  it("creates, reads, updates and audits in the same transaction", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const body = shopBody();
    const created = await h.call<AdminShopSummary>("POST", "/admin/shops", { actor: admin, body });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: body["code"]?.toUpperCase(), status: "ACTIVE", cashierCount: 0, balance: 0 });

    expect((await h.call("POST", "/admin/shops", { actor: admin, body })).status).toBe(409);
    expect((await h.call("POST", "/admin/shops", { actor: admin, body: { ...shopBody(), balance: 5 } })).status).toBe(422);

    const id = created.body.id;
    const updated = await h.call<AdminShopSummary>("PATCH", `/admin/shops/${id}`, { actor: admin, body: { phone: "+234 801 222 1044" } });

    expect(updated.body.phone).toBe("+234 801 222 1044");
    expect((await h.call("PATCH", `/admin/shops/${id}`, { actor: admin, body: { code: "OTHER-001" } })).status).toBe(422);
    expect((await h.call("PATCH", `/admin/shops/${id}`, { actor: admin, body: {} })).status).toBe(422);
    expect((await h.call("GET", `/admin/shops/${randomUUID()}`, { actor: admin })).status).toBe(404);
    expect((await h.call("GET", "/admin/shops/not-a-uuid", { actor: admin })).status).toBe(422);

    const again = await h.call<ErrorBody>("POST", `/admin/shops/${id}/status`, { actor: admin, body: { status: "ACTIVE", reason: "Already active" } });

    expect(again.status).toBe(409);
    expect((await h.call("POST", `/admin/shops/${id}/status`, { actor: admin, body: { status: "SUSPENDED" } })).status).toBe(422);

    const trail = await h.prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });

    expect(trail.map((row) => row.action)).toEqual(["shop_created", "shop_updated"]);
    expect(trail[1]).toMatchObject({ actorId: admin.id, actorRole: "SUPER_ADMIN", before: { phone: body["phone"] }, after: { phone: "+234 801 222 1044" } });
  });
});

describe("audit log", () => {
  it("redacts secrets server-side, pages, filters and cannot be rewritten", async () => {
    const entityId = randomUUID();

    const recorded = await h.rpc<{ id: string }>("identity.recordAudit", {
      actorId: "system",
      actorRole: "SYSTEM",
      action: "risk_configuration_changed",
      entityType: "risk_limits",
      entityId,
      before: { maxStake: 1, apiToken: "tok_live", nested: { passwordHash: "h", keep: true } },
      after: { maxStake: 2, cashier: { pin: "1234", temporaryPassword: "p", name: "Ada" }, totpSecret: "S" },
      reason: null,
      severity: "CRITICAL",
      requestId: "req-audit-test",
    });

    expect(recorded.success).toBe(true);

    const row = await h.prisma.auditLog.findUniqueOrThrow({ where: { id: recorded.result?.id ?? "" } });

    expect(row.before).toEqual({ maxStake: 1, nested: { keep: true } });
    expect(row.after).toEqual({ maxStake: 2, cashier: { name: "Ada" } });
    expect(row.actorName).toBe("System");

    const page = await h.call<Page<AuditLogEntry>>("GET", `/admin/audit?resource=${entityId}&severity=CRITICAL&pageSize=5`, { actor: adminActor("SUPPORT") });

    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(page.body.items[0]).toMatchObject({ actor: "system", role: "SYSTEM", action: "risk_configuration_changed", resource: "risk_limits", resourceId: entityId, requestId: "req-audit-test" });
    expect(JSON.stringify(page.body)).not.toMatch(/tok_live|1234|totp/iu);

    expect((await h.call("GET", "/admin/audit?pageSize=500", { actor: adminActor("SUPPORT") })).status).toBe(422);
    expect((await h.call("GET", "/admin/audit?sort=actor_id", { actor: adminActor("SUPPORT") })).status).toBe(422);

    const invalid = await h.rpc("identity.recordAudit", { actorId: "system", action: "x" });

    expect(invalid.error?.code).toBe("RPC_VALIDATION_ERROR");

    await expect(h.prisma.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })).rejects.toThrow();
    await expect(h.prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });

  it("writes an entry for every mutating admin route", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const customer = await h.makeCustomer();
    const shop = await h.makeShop();

    await h.call("POST", `/admin/users/${customer.id}/status`, { actor: admin, body: { status: "SUSPENDED", reason: "Duplicate account" } });
    await h.call("POST", `/admin/shops/${shop.id}/status`, { actor: admin, body: { status: "SUSPENDED", reason: "Licence lapsed" } });

    const created = await h.call<{ username: string }>("POST", `/admin/shops/${shop.id}/cashiers`, {
      actor: admin,
      body: { username: `c${randomUUID().slice(0, 6)}`, displayName: "Audit Cashier", role: "CASHIER" },
    });
    const cashier = await h.store.cashiers.findByShopAndUsername(shop.id, created.body.username);
    const cashierId = cashier?.id ?? "";

    await h.call("POST", `/admin/shops/${shop.id}/cashiers/${cashierId}/status`, { actor: admin, body: { status: "SUSPENDED", reason: "Left the company" } });
    await h.call("POST", `/admin/shops/${shop.id}/cashiers/${cashierId}/reset-credentials`, { actor: admin });

    const rows = await h.prisma.auditLog.findMany({ where: { actorId: admin.id ?? "" }, orderBy: { createdAt: "asc" } });

    expect(rows.map((row) => row.action)).toEqual([
      "customer_status_changed",
      "shop_status_changed",
      "cashier_created",
      "cashier_status_changed",
      "cashier_credentials_reset",
    ]);
    expect(rows[0]).toMatchObject({ reason: "Duplicate account", before: { status: "ACTIVE" }, after: { status: "SUSPENDED" }, severity: "WARNING" });
    expect(JSON.stringify(rows)).not.toMatch(/temporary|scrypt/iu);
  });
});

describe("platform settings", () => {
  it("versions every change, requires a reason and audits before/after", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const current = await h.call<PlatformSettings>("GET", "/admin/settings", { actor: adminActor("OPERATIONS") });

    expect(current.status).toBe(200);

    const before = await h.prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    const ticketExpiryDays = current.body.ticketExpiryDays === 45 ? 46 : 45;

    expect((await h.call("PATCH", "/admin/settings", { actor: admin, body: { ticketExpiryDays } })).status).toBe(422);
    expect((await h.call("PATCH", "/admin/settings", { actor: admin, body: { reason: "Nothing to change" } })).status).toBe(422);
    expect((await h.call("PATCH", "/admin/settings", { actor: admin, body: { minStake: current.body.maxStake, reason: "Inverted limits" } })).status).toBe(422);
    expect((await h.call("PATCH", "/admin/settings", { actor: admin, body: { unknownKnob: 1, reason: "Unknown key" } })).status).toBe(422);
    expect((await h.call("PATCH", "/admin/settings", { actor: adminActor("OPERATIONS"), body: { ticketExpiryDays, reason: "Read-only role" } })).status).toBe(403);

    const patched = await h.call<PlatformSettings>("PATCH", "/admin/settings", { actor: admin, body: { ticketExpiryDays, reason: "Shorter ticket life" } });

    expect(patched.status).toBe(200);
    expect(patched.body).toEqual({ ...current.body, ticketExpiryDays });

    const after = await h.prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });

    expect(after.version).toBe(before.version + 1);
    expect(after.updatedBy).toBe(admin.id);

    const entry = await h.prisma.auditLog.findFirstOrThrow({ where: { actorId: admin.id ?? "", action: "platform_settings_changed" } });

    expect(entry).toMatchObject({
      severity: "CRITICAL",
      reason: "Shorter ticket life",
      before: { version: before.version, ticketExpiryDays: current.body.ticketExpiryDays },
      after: { version: before.version + 1, ticketExpiryDays },
    });

    expect(await h.store.settings.replace(before.version, current.body, "stale-writer", new Date())).toBe(false);
  });
});

describe("cross-schema figures", () => {
  it("answers zeros while the wallet and betting tables are missing, then real aggregates", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const customer = await h.makeCustomer();
    const shop = await h.makeShop();
    const cashier = await h.makeCashier(shop, "CASHIER");
    const su = h.superuser;

    // Fixture tables are dropped and rebuilt, so this must only ever run in identity's own test database.
    const [where] = await su.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;

    expect(where?.name).toBe(TEST_DATABASE);

    await su.$executeRawUnsafe("DROP TABLE IF EXISTS betting.tickets, betting.bets, wallet.wallet_accounts");

    const empty = await h.call<{ items: AdminCustomer[] }>("GET", `/admin/users?q=${encodeURIComponent(customer.email)}`, { actor: admin });

    expect(empty.status).toBe(200);
    expect(empty.body.items).toHaveLength(1);
    expect(empty.body.items[0]).toMatchObject({ id: customer.id, balance: 0, openBets: 0, lifetimeStake: 0, lifetimePayout: 0 });
    expect(h.logs.filter((line) => line.includes("read_model_table_missing") && line.includes("wallet.wallet_accounts"))).toHaveLength(1);

    await su.$executeRawUnsafe(`CREATE TABLE wallet.wallet_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type text NOT NULL, owner_id uuid NOT NULL, balance bigint NOT NULL, UNIQUE (owner_type, owner_id))`);
    await su.$executeRawUnsafe(`CREATE TABLE betting.bets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, channel text NOT NULL, shop_id uuid, cashier_id uuid, stake bigint NOT NULL, status text NOT NULL, payout bigint, placed_at timestamptz NOT NULL DEFAULT now())`);
    await su.$executeRawUnsafe(`CREATE TABLE betting.tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bet_id uuid NOT NULL UNIQUE, shop_id uuid NOT NULL, cashier_id uuid NOT NULL, status text NOT NULL, paid_at timestamptz, paid_by uuid)`);
    await su.$executeRawUnsafe("GRANT SELECT ON wallet.wallet_accounts, betting.bets, betting.tickets TO betng_reader");

    await su.$executeRawUnsafe("INSERT INTO wallet.wallet_accounts (owner_type, owner_id, balance) VALUES ('CUSTOMER', $1::uuid, 125000), ('SHOP', $2::uuid, 9000000)", customer.id, shop.id);
    await su.$executeRawUnsafe(
      `INSERT INTO betting.bets (user_id, channel, stake, status, payout) VALUES
        ($1::uuid, 'ONLINE', 10000, 'PENDING', NULL), ($1::uuid, 'ONLINE', 20000, 'WON', 50000),
        ($1::uuid, 'ONLINE', 30000, 'LOST', 0), ($1::uuid, 'ONLINE', 40000, 'VOID', 40000)`,
      customer.id,
    );

    const openBet = randomUUID();
    const paidBet = randomUUID();
    const cancelledBet = randomUUID();

    await su.$executeRawUnsafe(
      `INSERT INTO betting.bets (id, channel, shop_id, cashier_id, stake, status, payout) VALUES
        ($1::uuid, 'SHOP', $4::uuid, $5::uuid, 5000, 'PENDING', NULL),
        ($2::uuid, 'SHOP', $4::uuid, $5::uuid, 7000, 'WON', 21000),
        ($3::uuid, 'SHOP', $4::uuid, $5::uuid, 9000, 'CANCELLED', NULL)`,
      openBet, paidBet, cancelledBet, shop.id, cashier.id,
    );
    await su.$executeRawUnsafe(
      `INSERT INTO betting.tickets (bet_id, shop_id, cashier_id, status, paid_at, paid_by) VALUES
        ($1::uuid, $4::uuid, $5::uuid, 'OPEN', NULL, NULL),
        ($2::uuid, $4::uuid, $5::uuid, 'PAID', now(), $5::uuid),
        ($3::uuid, $4::uuid, $5::uuid, 'CANCELLED', NULL, NULL)`,
      openBet, paidBet, cancelledBet, shop.id, cashier.id,
    );

    const users = await h.call<{ items: AdminCustomer[] }>("GET", `/admin/users?q=${encodeURIComponent(customer.email)}`, { actor: admin });

    expect(users.body.items[0]).toMatchObject({ balance: 125_000, openBets: 1, lifetimeStake: 60_000, lifetimePayout: 50_000 });

    const summary = await h.call<AdminShopSummary>("GET", `/admin/shops/${shop.id}`, { actor: admin });

    expect(summary.body).toMatchObject({ balance: 9_000_000, cashierCount: 1, todaySales: 12_000, todayPayouts: 21_000, openTickets: 1 });

    const staff = await h.call<{ items: AdminCashierSummary[] }>("GET", `/admin/shops/${shop.id}/cashiers`, { actor: admin });

    expect(staff.body.items[0]).toMatchObject({ id: cashier.id, todayTransactions: 4, todaySales: 12_000 });
    expect(JSON.stringify(staff.body)).not.toMatch(/hash/iu);
  });
});
