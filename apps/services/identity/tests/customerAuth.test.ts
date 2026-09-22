import { createHash } from "node:crypto";
import type { CustomerProfile, CustomerSession, RegistrationPending } from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadIdentityConfig } from "../src/configs/index.js";
import { adminActor, freshEmail, PASSWORD, PRODUCTION_REQUIREMENTS, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

async function register(email: string): Promise<void> {
  const reply = await h.call<RegistrationPending>("POST", "/auth/register", {
    body: { email, password: PASSWORD, displayName: "New Customer" },
  });

  expect(reply.status).toBe(200);
  expect(reply.body).toMatchObject({ email, verificationRequired: true });
}

describe("customer registration and session lifecycle", () => {
  it("register → verify → login → me → logout → token dead", async () => {
    const email = freshEmail();

    await register(email);

    const verified = await h.call<CustomerSession>("POST", "/auth/verify", {
      body: { email, code: h.issuedCode(email) },
    });

    expect(verified.status).toBe(200);
    expect(verified.body.user.email).toBe(email);

    const login = await h.call<CustomerSession>("POST", "/auth/login", { body: { email, password: PASSWORD } });

    expect(login.status).toBe(200);
    expect(login.body.token.length).toBeGreaterThanOrEqual(32);
    expect(JSON.stringify(login.body)).not.toMatch(/hash/iu);

    const { token } = login.body;
    const me = await h.call<CustomerProfile>("GET", "/auth/me", { token });

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(login.body.user.id);

    const actor = await h.rpc<{ kind: string; id: string; permissions: string[] }>("identity.authenticate", { token });

    expect(actor.result).toMatchObject({ kind: "CUSTOMER", id: me.body.id, role: "CUSTOMER", permissions: [] });

    expect((await h.call("POST", "/auth/logout", { token })).status).toBe(204);

    const after = await h.call<ErrorBody>("GET", "/auth/me", { token });

    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("UNAUTHENTICATED");
    expect((await h.rpc("identity.authenticate", { token })).error?.code).toBe("UNAUTHENTICATED");
  });

  it("stores only the hash of a session token", async () => {
    const customer = await h.makeCustomer();
    const login = await h.call<CustomerSession>("POST", "/auth/login", {
      body: { email: customer.email, password: PASSWORD },
    });
    const { token } = login.body;
    const rows = await h.prisma.session.findMany({ where: { subjectId: customer.id } });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("refuses a duplicate registration, and one that reuses an admin's address", async () => {
    const email = freshEmail();

    await register(email);

    const again = await h.call<ErrorBody>("POST", "/auth/register", {
      body: { email: email.toUpperCase(), password: "another-password", displayName: "Someone Else" },
    });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("CONFLICT");

    const admin = await h.makeAdmin("SUPPORT");
    const asAdmin = await h.call<ErrorBody>("POST", "/auth/register", {
      body: { email: admin.email, password: PASSWORD, displayName: "Not A Customer" },
    });

    expect(asAdmin.status).toBe(409);
  });

  it("rejects malformed and unknown input", async () => {
    const short = await h.call<ErrorBody>("POST", "/auth/register", {
      body: { email: freshEmail(), password: "short", displayName: "Short Password" },
    });
    const extra = await h.call<ErrorBody>("POST", "/auth/register", {
      body: { email: freshEmail(), password: PASSWORD, displayName: "Extra", role: "ADMIN" },
    });

    expect(short.status).toBe(422);
    expect(extra.status).toBe(422);
    expect(extra.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("e-mail verification", () => {
  it("caps wrong-code attempts, after which even the right code fails", async () => {
    const email = freshEmail();

    await register(email);

    const right = h.issuedCode(email);
    const wrong = right === "000000" ? "000001" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reply = await h.call<ErrorBody>("POST", "/auth/verify", { body: { email, code: wrong } });

      expect(reply.status).toBe(422);
    }

    const locked = await h.call<ErrorBody>("POST", "/auth/verify", { body: { email, code: right } });

    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("RATE_LIMITED");
  });

  it("stores the code hashed and refuses an expired one", async () => {
    const email = freshEmail();

    await register(email);

    const code = h.issuedCode(email);
    const customer = await h.store.customers.findByEmail(email);
    const row = await h.prisma.emailVerification.findFirstOrThrow({ where: { customerId: customer?.id ?? "" } });

    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/u);

    await h.prisma.emailVerification.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await h.call("POST", "/auth/verify", { body: { email, code } })).status).toBe(422);
  });

  it("resend issues a new code, spends the old one and is rate limited", async () => {
    const email = freshEmail();

    await register(email);

    const first = h.issuedCode(email);
    const tooSoon = await h.call<ErrorBody>("POST", "/auth/verify/resend", { body: { email } });

    expect(tooSoon.status).toBe(429);

    const customer = await h.store.customers.findByEmail(email);

    await h.prisma.emailVerification.updateMany({
      where: { customerId: customer?.id ?? "" },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });

    expect((await h.call("POST", "/auth/verify/resend", { body: { email } })).status).toBe(204);

    const second = h.issuedCode(email);
    const live = await h.prisma.emailVerification.count({ where: { customerId: customer?.id ?? "", consumedAt: null } });

    expect(live).toBe(1);

    if (second !== first) {
      expect((await h.call("POST", "/auth/verify", { body: { email, code: first } })).status).toBe(422);
    }

    expect((await h.call("POST", "/auth/verify", { body: { email, code: second } })).status).toBe(200);
    expect((await h.call("POST", "/auth/verify/resend", { body: { email: freshEmail() } })).status).toBe(204);
  });

  it("honours DEV_VERIFICATION_CODE only outside production and never logs codes in production", async () => {
    const base = {
      IDENTITY_DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=identity",
      DEV_VERIFICATION_CODE: "123456",
      LOG_VERIFICATION_CODES: "true",
      SEED_DEMO_DATA: "true",
    };
    const development = await loadIdentityConfig({ ...base, NODE_ENV: "development" });
    const { SEED_DEMO_DATA: _seed, ...withoutSeed } = base;
    const production = await loadIdentityConfig({ ...withoutSeed, ...PRODUCTION_REQUIREMENTS, NODE_ENV: "production" });

    await expect(loadIdentityConfig({ ...base, ...PRODUCTION_REQUIREMENTS, NODE_ENV: "production" })).rejects.toThrow(/SEED_DEMO_DATA/u);
    await expect(loadIdentityConfig({ ...base, NODE_ENV: "staging" })).rejects.toThrow(/NODE_ENV/u);
    const unset = await loadIdentityConfig({ IDENTITY_DATABASE_URL: base.IDENTITY_DATABASE_URL, NODE_ENV: "test" });

    expect(development.security.devVerificationCode).toBe("123456");
    expect(development.security.logVerificationCodes).toBe(true);
    expect(production.security.devVerificationCode).toBeUndefined();
    expect(production.security.logVerificationCodes).toBe(false);
    expect(development.security.seedDemoData).toBe(true);
    expect(production.security.seedDemoData).toBe(false);
    expect(unset.security.seedDemoData).toBe(false);
    expect(unset.security.logVerificationCodes).toBe(false);
    expect(unset.security.devVerificationCode).toBeUndefined();
    expect(unset.security).toMatchObject({ customerSessionTtlHours: 168, cashierSessionTtlHours: 12, adminSessionTtlHours: 8 });
  });
});

describe("customer sign-in", () => {
  it("answers an unverified account with 409 CONFLICT", async () => {
    const customer = await h.makeCustomer({ verified: false });
    const reply = await h.call<ErrorBody>("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } });

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("CONFLICT");
  });

  it("answers wrong password and unknown address identically", async () => {
    const customer = await h.makeCustomer();
    const wrong = await h.call<ErrorBody>("POST", "/auth/login", { body: { email: customer.email, password: "not-the-password" } });
    const unknown = await h.call<ErrorBody>("POST", "/auth/login", { body: { email: freshEmail(), password: PASSWORD } });

    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    expect({ ...unknown.body.error, requestId: "" }).toEqual({ ...wrong.body.error, requestId: "" });
  });

  it("suspension revokes sessions and refuses sign-in with 403", async () => {
    const customer = await h.makeCustomer();
    const login = await h.call<CustomerSession>("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } });

    const suspended = await h.call("POST", `/admin/users/${customer.id}/status`, {
      actor: adminActor("SUPER_ADMIN"),
      body: { status: "SUSPENDED", reason: "Chargeback investigation" },
    });

    expect(suspended.status).toBe(200);
    expect((await h.call("GET", "/auth/me", { token: login.body.token })).status).toBe(401);

    const retry = await h.call<ErrorBody>("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } });

    expect(retry.status).toBe(403);
    expect(retry.body.error.code).toBe("FORBIDDEN");
  });

  it("locks an identifier after 8 consecutive failures, known or unknown alike", async () => {
    const customer = await h.makeCustomer();

    for (const email of [customer.email, freshEmail()]) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const reply = await h.call("POST", "/auth/login", { body: { email, password: "wrong-password" } });

        expect(reply.status).toBe(401);
      }

      const locked = await h.call<ErrorBody>("POST", "/auth/login", { body: { email, password: PASSWORD } });

      expect(locked.status).toBe(429);
      expect(locked.body.error.code).toBe("RATE_LIMITED");
    }

    const throttle = await h.prisma.loginThrottle.findMany({ where: { lockedUntil: { gt: new Date(Date.now() + 14 * 60_000) } } });

    expect(throttle.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(throttle)).not.toContain(customer.email);
  });

  it("answers an expired session with SESSION_EXPIRED", async () => {
    const customer = await h.makeCustomer();
    const login = await h.call<CustomerSession>("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } });

    await h.prisma.session.updateMany({ where: { subjectId: customer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const me = await h.call<ErrorBody>("GET", "/auth/me", { token: login.body.token });

    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("SESSION_EXPIRED");
    expect((await h.rpc("identity.authenticate", { token: login.body.token })).error?.code).toBe("SESSION_EXPIRED");
  });

  it("identifies the caller from the bearer token and ignores forged actor headers", async () => {
    const victim = await h.makeCustomer();
    const caller = await h.makeCustomer();
    const forged = { kind: "CUSTOMER", id: victim.id } as const;

    const noToken = await h.call<ErrorBody>("GET", "/auth/me", { actor: forged });

    expect(noToken.status).toBe(401);

    const login = await h.call<CustomerSession>("POST", "/auth/login", { body: { email: caller.email, password: PASSWORD } });
    const me = await h.call<CustomerProfile>("GET", "/auth/me", { token: login.body.token, actor: forged });

    expect(me.body.id).toBe(caller.id);

    await h.call("POST", "/auth/logout", { actor: forged });

    expect(await h.prisma.session.count({ where: { subjectId: victim.id, revokedAt: { not: null } } })).toBe(0);
  });

  it("forgot-password always answers 204 in the same time", async () => {
    const customer = await h.makeCustomer();
    const timed = async (email: string): Promise<{ status: number; ms: number }> => {
      const started = performance.now();
      const reply = await h.call("POST", "/auth/password/forgot", { body: { email } });

      return { status: reply.status, ms: performance.now() - started };
    };

    const known = await timed(customer.email);
    const unknown = await timed(freshEmail());

    expect(known.status).toBe(204);
    expect(unknown.status).toBe(204);
    expect(known.ms).toBeGreaterThanOrEqual(395);
    expect(unknown.ms).toBeGreaterThanOrEqual(395);
    expect(Math.abs(known.ms - unknown.ms)).toBeLessThan(150);

    const reset = await h.prisma.passwordReset.findFirstOrThrow({ where: { customerId: customer.id } });

    expect(reset.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  });
});
