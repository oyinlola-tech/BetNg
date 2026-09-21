import type { AdminRole, AdminSession, CashierCredentials, ShopSession } from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE_PERMISSIONS, SHOP_ROLE_PERMISSIONS } from "../src/constants/index.js";
import { generateTotp } from "../src/utils/index.js";
import { adminActor, cashierActor, freshEmail, PASSWORD, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 });

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("shop terminal sign-in", () => {
  it("needs the right shop code, and resolves permissions from the role", async () => {
    const shop = await h.makeShop();
    const otherShop = await h.makeShop();
    const cashier = await h.makeCashier(shop, "MANAGER");
    const credentials = { username: cashier.username, password: PASSWORD };

    const wrongShop = await h.call<ErrorBody>("POST", "/shop/auth/login", { body: { shopCode: otherShop.code, ...credentials } });
    const noShop = await h.call<ErrorBody>("POST", "/shop/auth/login", { body: { shopCode: "NOPE-000", ...credentials } });

    expect(wrongShop.status).toBe(401);
    expect(wrongShop.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(noShop.status).toBe(401);

    const wrongPin = await h.call("POST", "/shop/auth/login", { body: { shopCode: shop.code, ...credentials, pin: "0000" } });

    expect(wrongPin.status).toBe(401);

    const login = await h.call<ShopSession>("POST", "/shop/auth/login", {
      body: { shopCode: shop.code.toLowerCase(), ...credentials, pin: "4711" },
    });

    expect(login.status).toBe(200);
    expect(login.body.shop).toMatchObject({ id: shop.id, code: shop.code });
    expect(Number.isInteger(login.body.shop.balance)).toBe(true);
    expect(login.body.permissions).toEqual(SHOP_ROLE_PERMISSIONS.MANAGER);
    expect(JSON.stringify(login.body)).not.toMatch(/hash/iu);

    const session = await h.call<ShopSession>("GET", "/shop/auth/session", { token: login.body.token });

    expect(session.status).toBe(200);
    expect(session.body.cashier.id).toBe(cashier.id);

    const actor = await h.rpc("identity.authenticate", { token: login.body.token });

    expect(actor.result).toMatchObject({ kind: "CASHIER", id: cashier.id, role: "MANAGER", shopId: shop.id, permissions: SHOP_ROLE_PERMISSIONS.MANAGER });

    expect((await h.call("GET", "/auth/me", { token: login.body.token })).status).toBe(401);
    expect((await h.call("POST", "/shop/auth/logout", { token: login.body.token })).status).toBe(204);
    expect((await h.call("GET", "/shop/auth/session", { token: login.body.token })).status).toBe(401);
  });

  it("refuses a suspended cashier and a suspended shop with 403, and revokes their sessions", async () => {
    const shop = await h.makeShop();
    const cashier = await h.makeCashier(shop, "CASHIER");
    const colleague = await h.makeCashier(shop, "CASHIER");
    const body = (username: string): object => ({ shopCode: shop.code, username, password: PASSWORD });
    const first = await h.call<ShopSession>("POST", "/shop/auth/login", { body: body(cashier.username) });
    const second = await h.call<ShopSession>("POST", "/shop/auth/login", { body: body(colleague.username) });
    const admin = adminActor("SUPER_ADMIN");

    const suspendCashier = await h.call("POST", `/admin/shops/${shop.id}/cashiers/${cashier.id}/status`, {
      actor: admin,
      body: { status: "SUSPENDED", reason: "Till discrepancy" },
    });

    expect(suspendCashier.status).toBe(200);
    expect((await h.rpc("identity.authenticate", { token: first.body.token })).error?.code).toBe("UNAUTHENTICATED");
    expect((await h.call("POST", "/shop/auth/login", { body: body(cashier.username) })).status).toBe(403);

    const suspendShop = await h.call("POST", `/admin/shops/${shop.id}/status`, {
      actor: admin,
      body: { status: "SUSPENDED", reason: "Licence lapsed" },
    });

    expect(suspendShop.status).toBe(200);
    expect((await h.call("GET", "/shop/auth/session", { token: second.body.token })).status).toBe(401);
    expect((await h.call("POST", "/shop/auth/login", { body: body(colleague.username) })).status).toBe(403);
  });

  it("lists cashiers of the actor's own shop only, for a role that may", async () => {
    const shop = await h.makeShop();
    const otherShop = await h.makeShop();
    const owner = await h.makeCashier(shop, "OWNER");
    const clerk = await h.makeCashier(shop, "CASHIER");

    await h.makeCashier(otherShop, "CASHIER");

    const list = await h.call<{ items: { id: string; shopId: string }[] }>("GET", "/shop/cashiers", { actor: cashierActor(owner) });

    expect(list.status).toBe(200);
    expect(list.body.items.map((item) => item.id).sort()).toEqual([owner.id, clerk.id].sort());
    expect(JSON.stringify(list.body)).not.toMatch(/hash/iu);

    expect((await h.call("GET", "/shop/cashiers", { actor: cashierActor(clerk) })).status).toBe(403);
    expect((await h.call("GET", "/shop/cashiers", { actor: adminActor("SUPER_ADMIN") })).status).toBe(403);
    expect((await h.call("GET", "/shop/cashiers")).status).toBe(401);
  });

  it("issues one-time credentials that work, and a reset that kills the old ones and their sessions", async () => {
    const shop = await h.makeShop();
    const admin = adminActor("SUPER_ADMIN");

    const created = await h.call<CashierCredentials>("POST", `/admin/shops/${shop.id}/cashiers`, {
      actor: admin,
      body: { username: "New.Cashier", displayName: "New Cashier", role: "CASHIER" },
    });

    expect(created.status).toBe(201);
    expect(created.body.username).toBe("new.cashier");
    expect(created.body.temporaryPin).toMatch(/^\d{6}$/u);

    const duplicate = await h.call("POST", `/admin/shops/${shop.id}/cashiers`, {
      actor: admin,
      body: { username: "new.cashier", displayName: "Twin", role: "CASHIER" },
    });

    expect(duplicate.status).toBe(409);

    const signIn = async (password: string, pin: string): Promise<{ status: number; body: ShopSession }> =>
      h.call<ShopSession>("POST", "/shop/auth/login", { body: { shopCode: shop.code, username: "new.cashier", password, pin } });

    const login = await signIn(created.body.temporaryPassword, created.body.temporaryPin);

    expect(login.status).toBe(200);

    const cashierId = login.body.cashier.id;
    const stored = await h.prisma.cashier.findUniqueOrThrow({ where: { id: cashierId } });

    expect(stored.passwordHash).not.toContain(created.body.temporaryPassword);
    expect(stored.pinHash).not.toContain(created.body.temporaryPin);
    expect(stored.credentialsExpireAt).toBeNull();

    const reset = await h.call<CashierCredentials>("POST", `/admin/shops/${shop.id}/cashiers/${cashierId}/reset-credentials`, { actor: admin });

    expect(reset.status).toBe(200);
    expect((await h.call("GET", "/shop/auth/session", { token: login.body.token })).status).toBe(401);
    expect((await signIn(created.body.temporaryPassword, created.body.temporaryPin)).status).toBe(401);

    await h.prisma.cashier.update({ where: { id: cashierId }, data: { credentialsExpireAt: new Date(Date.now() - 1000) } });

    expect((await signIn(reset.body.temporaryPassword, reset.body.temporaryPin)).status).toBe(401);

    const wrongShop = await h.call("POST", `/admin/shops/${(await h.makeShop()).id}/cashiers/${cashierId}/reset-credentials`, { actor: admin });

    expect(wrongShop.status).toBe(404);
  });
});

describe("identity.verifyCashierPin", () => {
  it("verifies the PIN and locks after repeated failures", async () => {
    const shop = await h.makeShop();
    const cashier = await h.makeCashier(shop, "CASHIER", "246813");

    expect((await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "246813" })).result).toEqual({ valid: true });
    expect((await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "111111" })).result).toEqual({ valid: false });
    expect((await h.rpc("identity.verifyCashierPin", { cashierId: shop.id, pin: "246813" })).result).toEqual({ valid: false });
    expect((await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "12" })).error?.code).toBe("RPC_VALIDATION_ERROR");

    await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "246813" });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "000000" });
    }

    const locked = await h.rpc("identity.verifyCashierPin", { cashierId: cashier.id, pin: "246813" });

    expect(locked.success).toBe(false);
    expect(locked.error?.code).toBe("RATE_LIMITED");
  });

  it("refuses /rpc without the internal token", async () => {
    const response = await fetch("http://127.0.0.1:4110/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "x", procedure: "identity.authenticate", payload: { token: "t".repeat(32) }, metadata: {}, timestamp: Date.now() }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe("admin sign-in", () => {
  it.each(["SUPER_ADMIN", "OPERATIONS", "RISK_ANALYST", "SUPPORT"] as const)("resolves %s permissions into the session", async (role: AdminRole) => {
    const admin = await h.makeAdmin(role);
    const login = await h.call<AdminSession>("POST", "/admin/auth/login", { body: { email: admin.email, password: PASSWORD } });

    expect(login.status).toBe(200);
    expect(login.body.admin.permissions).toEqual(ADMIN_ROLE_PERMISSIONS[role]);
    expect(JSON.stringify(login.body)).not.toMatch(/hash|secret/iu);

    const actor = await h.rpc("identity.authenticate", { token: login.body.token });

    expect(actor.result).toMatchObject({ kind: "ADMIN", id: admin.id, role, permissions: ADMIN_ROLE_PERMISSIONS[role] });

    const session = await h.call<AdminSession>("GET", "/admin/auth/session", { token: login.body.token });

    expect(session.body.admin.id).toBe(admin.id);
    expect((await h.call("POST", "/admin/auth/logout", { token: login.body.token })).status).toBe(204);
    expect((await h.call("GET", "/admin/auth/session", { token: login.body.token })).status).toBe(401);

    const actions = await h.prisma.auditLog.findMany({ where: { actorId: admin.id }, orderBy: { createdAt: "asc" } });

    expect(actions.map((row) => row.action)).toEqual(["admin_login", "admin_logout"]);
  });

  it("requires a TOTP code when 2FA is on, and refuses a replayed one", async () => {
    const admin = await h.makeAdmin("SUPER_ADMIN", { totp: true });
    const credentials = { email: admin.email, password: PASSWORD };

    const withoutCode = await h.call<ErrorBody>("POST", "/admin/auth/login", { body: credentials });

    expect(withoutCode.status).toBe(422);
    expect(withoutCode.body.error.code).toBe("VALIDATION_FAILED");

    const wrongPassword = await h.call<ErrorBody>("POST", "/admin/auth/login", { body: { ...credentials, password: "nope-nope-nope", code: "123456" } });

    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");

    const code = generateTotp(admin.secret ?? "", Date.now());
    const wrongCode = code === "000000" ? "000001" : "000000";

    expect((await h.call("POST", "/admin/auth/login", { body: { ...credentials, code: wrongCode } })).status).toBe(422);

    const login = await h.call<AdminSession>("POST", "/admin/auth/login", { body: { ...credentials, code } });

    expect(login.status).toBe(200);
    expect(login.body.admin.twoFactorEnabled).toBe(true);

    const replay = await h.call<ErrorBody>("POST", "/admin/auth/login", { body: { ...credentials, code } });

    expect(replay.status).toBe(422);

    const failures = await h.prisma.auditLog.findMany({ where: { actorId: admin.id, action: "admin_login_failed" } });

    expect(failures.length).toBe(3);
    expect(JSON.stringify(failures)).not.toContain(admin.secret ?? "-");
  });

  it("audits a failed sign-in for an unknown address, and locks after repeated failures", async () => {
    const email = freshEmail();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect((await h.call("POST", "/admin/auth/login", { body: { email, password: "wrong-password" } })).status).toBe(401);
    }

    expect((await h.call("POST", "/admin/auth/login", { body: { email, password: "wrong-password" } })).status).toBe(429);

    const rows = await h.prisma.auditLog.findMany({ where: { action: "admin_login_failed", actorId: "unknown" } });

    expect(rows.filter((row) => JSON.stringify(row.after).includes(email))).toHaveLength(8);
  });
});

describe("an admin is not a customer", () => {
  it("cannot authenticate as a customer, and no customer row exists for any admin", async () => {
    const admin = await h.makeAdmin("SUPER_ADMIN");
    const asCustomer = await h.call<ErrorBody>("POST", "/auth/login", { body: { email: admin.email, password: PASSWORD } });

    expect(asCustomer.status).toBe(401);
    expect(asCustomer.body.error.code).toBe("INVALID_CREDENTIALS");

    const login = await h.call<AdminSession>("POST", "/admin/auth/login", { body: { email: admin.email, password: PASSWORD } });

    expect((await h.call("GET", "/auth/me", { token: login.body.token })).status).toBe(401);
    expect((await h.rpc<{ kind: string }>("identity.authenticate", { token: login.body.token })).result?.kind).toBe("ADMIN");

    const overlap = await h.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM identity.customers c
      JOIN identity.admin_users a ON a.id = c.id OR lower(a.email) = lower(c.email)`;

    expect(overlap[0]?.n).toBe(0);

    await expect(
      h.prisma.customer.create({ data: { email: admin.email, displayName: "Shadow", passwordHash: "x" } }),
    ).rejects.toThrow();

    const customer = await h.makeCustomer();

    await expect(
      h.store.admins.create({ email: customer.email, name: "Shadow", role: "SUPPORT", passwordHash: "x", totpSecret: undefined }),
    ).rejects.toThrow();
  });
});
