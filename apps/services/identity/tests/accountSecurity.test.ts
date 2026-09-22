import { createHash, randomUUID } from "node:crypto";
import type {
  AccountDeletion,
  AccountSession,
  BackupCodes,
  CustomerSession,
  SessionRefresh,
  TwoFactorChallenge,
  TwoFactorEnrollment,
  TwoFactorStatus,
} from "@betng/contracts";
import {
  accountDeletionSchema,
  accountSessionSchema,
  backupCodesSchema,
  sessionRefreshSchema,
  twoFactorChallengeSchema,
  twoFactorEnrollmentSchema,
  twoFactorStatusSchema,
} from "@betng/contracts";
import { createRedisConnection } from "@betng/service-kit";
import type { RedisConnection } from "@betng/service-kit";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { completeDueDeletions } from "../src/jobs/index.js";
import { adminTotpContext, LoginAdminCommand, LoginAdminHandler } from "../src/services/index.js";
import { createSessionCacheEvictor } from "../src/services/security/index.js";
import { generateTotp } from "../src/utils/index.js";
import { PASSWORD, resetReadModelFixtures, signIn, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let h: Harness;
let redis: RedisConnection;

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const cacheKey = (token: string): string => `gateway:actor:${createHash("sha256").update(token).digest("hex")}`;

beforeAll(async () => {
  h = await startHarness();

  const url = process.env["REDIS_URL"];

  if (url === undefined) {
    throw new Error("REDIS_URL must be set for the eviction tests.");
  }

  redis = createRedisConnection(url);
  await redis.connect();
  await resetReadModelFixtures(h);
});

afterAll(async () => {
  await redis.close();
  await h.stop();
});

interface Enrolled {
  readonly email: string;
  readonly customerId: string;
  readonly token: string;
  readonly secret: string;
  readonly codes: readonly string[];
  readonly confirmedAtMs: number;
}

async function enrolled(): Promise<Enrolled> {
  const customer = await h.makeCustomer();
  const { token } = await signIn(h, customer.email);
  const enrollment = await h.call<TwoFactorEnrollment>("POST", "/account/2fa/enroll", { token });

  expect(enrollment.status).toBe(200);
  twoFactorEnrollmentSchema.parse(enrollment.body);

  const secret = enrollment.body.manualKey.replaceAll(" ", "");
  const confirmedAtMs = Date.now();
  const confirm = await h.call<BackupCodes>("POST", "/account/2fa/confirm", {
    token,
    body: { enrollmentId: enrollment.body.enrollmentId, code: generateTotp(secret, confirmedAtMs) },
  });

  expect(confirm.status).toBe(200);

  return { email: customer.email, customerId: customer.id, token, secret, codes: confirm.body.codes, confirmedAtMs };
}

async function challenge(email: string): Promise<TwoFactorChallenge> {
  const reply = await h.call<{ twoFactor: TwoFactorChallenge; token?: string }>("POST", "/auth/login", {
    body: { email, password: PASSWORD },
    headers: { "user-agent": IPHONE },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.token).toBeUndefined();

  return twoFactorChallengeSchema.parse(reply.body.twoFactor);
}

describe("customer two-factor authentication", () => {
  it("enrols with a server-side secret stored encrypted and backup codes stored hashed", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);

    const before = await h.call<TwoFactorStatus>("GET", "/account/2fa", { token });

    expect(twoFactorStatusSchema.parse(before.body)).toEqual({ enabled: false, required: false });

    const enrollment = await h.call<TwoFactorEnrollment>("POST", "/account/2fa/enroll", { token });
    const secret = enrollment.body.manualKey.replaceAll(" ", "");

    expect(enrollment.body.otpauthUri).toContain(`secret=${secret}`);
    expect(enrollment.body.otpauthUri).toContain(encodeURIComponent(customer.email));

    const stored = await h.prisma.twoFactorEnrollment.findUniqueOrThrow({ where: { id: enrollment.body.enrollmentId } });

    expect(stored.secretCiphertext).not.toContain(secret);
    expect(stored.secretCiphertext.startsWith("v1.")).toBe(true);

    const wrong = await h.call<ErrorBody>("POST", "/account/2fa/confirm", {
      token,
      body: { enrollmentId: enrollment.body.enrollmentId, code: generateTotp(secret, Date.now() - 300_000) },
    });

    expect(wrong.status).toBe(422);

    const confirmed = await h.call<BackupCodes>("POST", "/account/2fa/confirm", {
      token,
      body: { enrollmentId: enrollment.body.enrollmentId, code: generateTotp(secret, Date.now()) },
    });

    expect(confirmed.status).toBe(200);
    expect(backupCodesSchema.parse(confirmed.body).codes).toHaveLength(10);

    const rows = await h.prisma.backupCode.findMany({ where: { customerId: customer.id } });
    const factor = await h.prisma.customerTwoFactor.findUniqueOrThrow({ where: { customerId: customer.id } });

    expect(rows).toHaveLength(10);
    expect(JSON.stringify(rows)).not.toContain(confirmed.body.codes[0]?.replace("-", ""));
    expect(factor.secretCiphertext).not.toContain(secret);

    const after = await h.call<TwoFactorStatus>("GET", "/account/2fa", { token });

    expect(after.body).toMatchObject({ enabled: true, method: "TOTP", backupCodesRemaining: 10, required: false });
    expect((await h.call("POST", "/account/2fa/confirm", { token, body: { enrollmentId: enrollment.body.enrollmentId, code: "123456" } })).status).toBe(422);
    expect((await h.call("POST", "/account/2fa/enroll", { token })).status).toBe(409);
  });

  it("answers sign-in with a challenge, refuses a replayed TOTP code and spends backup codes once", async () => {
    const account = await enrolled();
    const first = await challenge(account.email);

    expect(first.methods).toEqual(["TOTP", "BACKUP_CODE"]);

    const replay = await h.call<ErrorBody>("POST", "/auth/login/2fa", {
      body: { challengeId: first.challengeId, code: generateTotp(account.secret, account.confirmedAtMs) },
    });

    expect(replay.status).toBe(422);
    expect(replay.body.error.code).toBe("VALIDATION_FAILED");

    const nextCode = generateTotp(account.secret, account.confirmedAtMs + 30_000);
    const session = await h.call<CustomerSession>("POST", "/auth/login/2fa", { body: { challengeId: first.challengeId, code: nextCode } });

    expect(session.status).toBe(200);
    expect(session.body.user.id).toBe(account.customerId);

    const reused = await h.call<ErrorBody>("POST", "/auth/login/2fa", { body: { challengeId: first.challengeId, code: nextCode } });

    expect(reused.status).toBe(422);

    const second = await challenge(account.email);

    expect((await h.call("POST", "/auth/login/2fa", { body: { challengeId: second.challengeId, code: nextCode } })).status).toBe(422);

    const backup = account.codes[0] ?? "";
    const withBackup = await h.call<CustomerSession>("POST", "/auth/login/2fa", { body: { challengeId: second.challengeId, code: backup } });

    expect(withBackup.status).toBe(200);

    const sessions = await h.call<{ items: AccountSession[] }>("GET", "/account/sessions", { token: withBackup.body.token });
    const current = sessions.body.items.find((item) => item.current);

    expect(current).toMatchObject({ platform: "iOS", device: "Phone" });

    const third = await challenge(account.email);

    expect((await h.call("POST", "/auth/login/2fa", { body: { challengeId: third.challengeId, code: backup.toLowerCase() } })).status).toBe(422);
    expect((await h.call<TwoFactorStatus>("GET", "/account/2fa", { token: account.token })).body.backupCodesRemaining).toBe(9);
  });

  it("limits guesses per challenge", async () => {
    const account = await enrolled();
    const pending = await challenge(account.email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await h.call("POST", "/auth/login/2fa", { body: { challengeId: pending.challengeId, code: "000000" } })).status).toBe(422);
    }

    const locked = await h.call<ErrorBody>("POST", "/auth/login/2fa", { body: { challengeId: pending.challengeId, code: "000000" } });

    expect(locked.status).toBe(429);
    expect((await h.call("POST", "/auth/login/2fa", { body: { challengeId: "not-a-real-challenge-id", code: "000000" } })).status).toBe(422);
  });

  it("disables with password and a code, and regenerates backup codes only with a valid code", async () => {
    const account = await enrolled();

    expect((await h.call("POST", "/account/2fa/backup-codes", { token: account.token, body: { code: "ZZZZ-ZZZZ" } })).status).toBe(422);

    const regenerated = await h.call<BackupCodes>("POST", "/account/2fa/backup-codes", { token: account.token, body: { code: account.codes[1] } });

    expect(regenerated.status).toBe(200);
    expect(regenerated.body.codes).not.toContain(account.codes[2]);

    const wrongPassword = await h.call<ErrorBody>("POST", "/account/2fa/disable", {
      token: account.token,
      body: { password: "not-the-password", code: regenerated.body.codes[0] },
    });

    expect(wrongPassword.status).toBe(422);
    expect((await h.call("POST", "/account/2fa/disable", { token: account.token, body: { password: PASSWORD, code: account.codes[2] } })).status).toBe(422);

    const disabled = await h.call<TwoFactorStatus>("POST", "/account/2fa/disable", {
      token: account.token,
      body: { password: PASSWORD, code: regenerated.body.codes[0] },
    });

    expect(disabled.body).toEqual({ enabled: false, required: false });
    expect(await h.prisma.backupCode.count({ where: { customerId: account.customerId } })).toBe(0);
    expect(await h.prisma.auditLog.count({ where: { entityId: account.customerId, action: "customer_two_factor_disabled" } })).toBe(1);

    const plain = await signIn(h, account.email);

    expect(plain.token.length).toBeGreaterThan(16);
  });
});

describe("password reset and change", () => {
  it("resets with an emailed code, revokes every session and evicts the gateway cache", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);

    await redis.client.set(cacheKey(token), "{}", { expiration: { type: "EX", value: 60 } });
    expect((await h.call("POST", "/auth/password/forgot", { body: { email: customer.email } })).status).toBe(204);

    const code = h.issuedResetCode(customer.email);
    const wrong = code === "000000" ? "111111" : "000000";

    expect((await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code: wrong, newPassword: "a-brand-new-password" } })).status).toBe(422);
    expect((await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code, newPassword: PASSWORD } })).status).toBe(422);

    const reset = await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code, newPassword: "a-brand-new-password" } });

    expect(reset.status).toBe(204);
    expect((await h.call<ErrorBody>("GET", "/auth/me", { token })).status).toBe(401);
    expect(await redis.client.get(cacheKey(token))).toBeNull();
    expect((await h.prisma.session.findFirstOrThrow({ where: { subjectId: customer.id } })).cacheEvictedAt).not.toBeNull();
    expect((await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code, newPassword: "yet-another-password" } })).status).toBe(422);
    expect((await h.call("POST", "/auth/login", { body: { email: customer.email, password: "a-brand-new-password" } })).status).toBe(200);
    expect(h.logs.some((line) => line.includes("email_logged") && line.includes(code))).toBe(false);
  });

  it("caps guesses per reset code and answers unknown addresses the same way", async () => {
    const customer = await h.makeCustomer();

    await h.call("POST", "/auth/password/forgot", { body: { email: customer.email } });

    const code = h.issuedResetCode(customer.email);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code: wrong, newPassword: "a-brand-new-password" } })).status).toBe(422);
    }

    const capped = await h.call<ErrorBody>("POST", "/auth/password/reset", { body: { email: customer.email, code, newPassword: "a-brand-new-password" } });
    const startedAt = Date.now();
    const unknown = await h.call<ErrorBody>("POST", "/auth/password/reset", { body: { email: `${randomUUID()}@example.test`, code, newPassword: "a-brand-new-password" } });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(390);
    expect(capped.status).toBe(422);
    expect(unknown.status).toBe(422);
    expect([capped.body.error.code, capped.body.error.message]).toEqual([unknown.body.error.code, unknown.body.error.message]);
    expect(unknown.body.error.message).toMatch(/not right or has expired/u);
  });

  it("changes the password, keeps this session, revokes the others and evicts their cache entries", async () => {
    const customer = await h.makeCustomer();
    const current = await signIn(h, customer.email);
    const other = await signIn(h, customer.email);

    await redis.client.set(cacheKey(other.token), "{}", { expiration: { type: "EX", value: 60 } });
    await redis.client.set(cacheKey(current.token), "{}", { expiration: { type: "EX", value: 60 } });

    const wrongCurrent = await h.call<ErrorBody & { error: { details: { path: string }[] } }>("PUT", "/account/password", {
      token: current.token,
      body: { currentPassword: "wrong-password", newPassword: "another-good-password" },
    });

    expect(wrongCurrent.status).toBe(422);
    expect(wrongCurrent.body.error.details[0]?.path).toBe("currentPassword");

    const reused = await h.call<ErrorBody & { error: { details: { path: string }[] } }>("PUT", "/account/password", {
      token: current.token,
      body: { currentPassword: PASSWORD, newPassword: PASSWORD },
    });

    expect(reused.status).toBe(422);
    expect(reused.body.error.details[0]?.path).toBe("newPassword");

    const changed = await h.call("PUT", "/account/password", {
      token: current.token,
      body: { currentPassword: PASSWORD, newPassword: "another-good-password" },
    });

    expect(changed.status).toBe(204);
    expect((await h.call("GET", "/auth/me", { token: current.token })).status).toBe(200);
    expect((await h.call("GET", "/auth/me", { token: other.token })).status).toBe(401);
    expect(await redis.client.get(cacheKey(other.token))).toBeNull();
    expect(await redis.client.get(cacheKey(current.token))).not.toBeNull();

    const actorOnly = await h.call("PUT", "/account/password", {
      actor: { kind: "CUSTOMER", id: customer.id },
      body: { currentPassword: "another-good-password", newPassword: "third-good-password" },
    });

    expect(actorOnly.status).toBe(401);
    await redis.client.del(cacheKey(current.token));
  });
});

describe("account sessions", () => {
  it("lists sessions with parsed labels, revokes one and all others, never the current one", async () => {
    const customer = await h.makeCustomer();
    const a = await signIn(h, customer.email, CHROME);
    const b = await signIn(h, customer.email, IPHONE);
    const c = await signIn(h, customer.email);

    const list = await h.call<{ items: AccountSession[] }>("GET", "/account/sessions", { token: a.token });

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(3);

    for (const item of list.body.items) {
      accountSessionSchema.parse(item);
      expect(item.location).toBeUndefined();
    }

    const mine = list.body.items.find((item) => item.current);

    expect(mine).toMatchObject({ browser: "Chrome 128", platform: "Windows", device: "Computer" });
    expect((await h.call("DELETE", `/account/sessions/${mine?.id ?? ""}`, { token: a.token })).status).toBe(409);

    const phone = list.body.items.find((item) => item.platform === "iOS");

    await redis.client.set(cacheKey(b.token), "{}", { expiration: { type: "EX", value: 60 } });
    expect((await h.call("DELETE", `/account/sessions/${phone?.id ?? ""}`, { token: a.token })).status).toBe(204);
    expect((await h.call("GET", "/auth/me", { token: b.token })).status).toBe(401);
    expect(await redis.client.get(cacheKey(b.token))).toBeNull();

    const stranger = await h.makeCustomer();
    const strangerSession = await signIn(h, stranger.email);
    const strangerRow = await h.prisma.session.findFirstOrThrow({ where: { subjectId: stranger.id } });

    expect((await h.call("DELETE", `/account/sessions/${strangerRow.id}`, { token: a.token })).status).toBe(404);
    expect((await h.call("GET", "/auth/me", { token: strangerSession.token })).status).toBe(200);

    expect((await h.call("DELETE", "/account/sessions", { token: a.token })).status).toBe(204);
    expect((await h.call("GET", "/auth/me", { token: c.token })).status).toBe(401);
    expect((await h.call("GET", "/auth/me", { token: a.token })).status).toBe(200);
  });

  it("slides the expiry on refresh but never past the absolute lifetime", async () => {
    const customer = await h.makeCustomer();
    const { token, expiresAt } = await signIn(h, customer.email);
    const row = await h.prisma.session.findFirstOrThrow({ where: { subjectId: customer.id } });

    await h.prisma.session.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() + 3_600_000) } });

    const refreshed = await h.call<SessionRefresh>("POST", "/auth/session/refresh", { token });

    expect(refreshed.status).toBe(200);
    expect(sessionRefreshSchema.parse(refreshed.body).token).toBeUndefined();
    expect(Date.parse(refreshed.body.expiresAt)).toBeGreaterThanOrEqual(Date.parse(expiresAt) - 5_000);

    const createdAt = new Date(Date.now() - 719 * 3_600_000);

    await h.prisma.session.update({ where: { id: row.id }, data: { createdAt, expiresAt: new Date(Date.now() + 60_000) } });

    const capped = await h.call<SessionRefresh>("POST", "/auth/session/refresh", { token });

    expect(Date.parse(capped.body.expiresAt)).toBeLessThanOrEqual(createdAt.getTime() + 720 * 3_600_000);
    expect((await h.call("POST", "/auth/session/refresh", { actor: { kind: "CUSTOMER", id: customer.id } })).status).toBe(401);
  });
});

describe("gateway session hash and realtime revocation", () => {
  it("identifies the current session from x-betng-session-hash on actor routes", async () => {
    const customer = await h.makeCustomer();
    const a = await signIn(h, customer.email, CHROME);
    const b = await signIn(h, customer.email, IPHONE);
    const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex");
    const actor = { kind: "CUSTOMER" as const, id: customer.id };

    const list = await h.call<{ items: AccountSession[] }>("GET", "/account/sessions", { actor, headers: { "x-betng-session-hash": hashOf(a.token) } });
    const current = list.body.items.filter((item) => item.current);

    expect(current).toHaveLength(1);
    expect(current[0]?.browser).toBe("Chrome 128");
    expect((await h.call("DELETE", `/account/sessions/${current[0]?.id ?? ""}`, { actor, headers: { "x-betng-session-hash": hashOf(a.token) } })).status).toBe(409);

    const stranger = await h.makeCustomer();
    const theirs = await signIn(h, stranger.email);

    expect((await h.call("GET", "/account/sessions", { actor, headers: { "x-betng-session-hash": hashOf(theirs.token) } })).status).toBe(401);
    expect((await h.call("GET", "/account/sessions", { actor, headers: { "x-betng-session-hash": hashOf(a.token) }, internal: false })).status).toBe(401);

    const changed = await h.call("PUT", "/account/password", {
      actor,
      headers: { "x-betng-session-hash": hashOf(a.token) },
      body: { currentPassword: PASSWORD, newPassword: "hash-routed-password" },
    });

    expect(changed.status).toBe(204);
    expect((await h.call("GET", "/auth/me", { token: a.token })).status).toBe(200);
    expect((await h.call("GET", "/auth/me", { token: b.token })).status).toBe(401);
  });

  it("tells the event service about each revoked session and retries what it could not deliver", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);
    const row = await h.prisma.session.findFirstOrThrow({ where: { subjectId: customer.id } });
    const delivered: string[] = [];
    let reachable = false;

    const evictor = createSessionCacheEvictor(h.store, undefined, {
      revoke: async (tokenHash) => {
        if (!reachable) throw new Error("event service down");
        delivered.push(tokenHash);
      },
    }, h.app.logger);

    await h.prisma.session.updateMany({ where: { realtimeRevokedAt: null, revokedAt: { not: null } }, data: { realtimeRevokedAt: new Date() } });
    expect((await h.call("POST", "/auth/logout", { token })).status).toBe(204);

    await evictor.flush();
    expect((await h.prisma.session.findUniqueOrThrow({ where: { id: row.id } })).realtimeRevokedAt).toBeNull();

    reachable = true;
    await evictor.flush();

    expect(delivered).toContain(createHash("sha256").update(token).digest("hex"));
    expect((await h.prisma.session.findUniqueOrThrow({ where: { id: row.id } })).realtimeRevokedAt).not.toBeNull();
  });

  it("queues event.revokeSessions for the sessions a password change or reset revoked, and not for the one kept", async () => {
    const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex");
    const changer = await h.makeCustomer();
    const kept = await signIn(h, changer.email);
    const dropped = await signIn(h, changer.email);
    const resetter = await h.makeCustomer();
    const forgotten = await signIn(h, resetter.email);

    await redis.client.set(cacheKey(dropped.token), "{}", { expiration: { type: "EX", value: 60 } });

    expect((await h.call("PUT", "/account/password", { token: kept.token, body: { currentPassword: PASSWORD, newPassword: "changed-for-realtime" } })).status).toBe(204);
    expect((await h.call("POST", "/auth/password/forgot", { body: { email: resetter.email } })).status).toBe(204);
    expect(
      (await h.call("POST", "/auth/password/reset", { body: { email: resetter.email, code: h.issuedResetCode(resetter.email), newPassword: "reset-for-realtime" } })).status,
    ).toBe(204);

    expect(await redis.client.get(cacheKey(dropped.token))).toBeNull();

    const delivered: string[] = [];
    const evictor = createSessionCacheEvictor(h.store, undefined, {
      revoke: async (tokenHash) => {
        delivered.push(tokenHash);
      },
    }, h.app.logger);

    await evictor.flush();

    expect(delivered).toContain(hashOf(dropped.token));
    expect(delivered).toContain(hashOf(forgotten.token));
    expect(delivered).not.toContain(hashOf(kept.token));
  });
});

describe("account deletion", () => {
  it("requires an Idempotency-Key and the password, reports blockers, replays by key and cancels", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);

    const none = await h.call<AccountDeletion>("GET", "/account/deletion", { token });

    expect(accountDeletionSchema.parse(none.body)).toEqual({ status: "NONE", cancellable: false });
    expect((await h.call("POST", "/account/deletion", { token, body: { password: PASSWORD } })).status).toBe(422);
    expect((await h.call("POST", "/account/deletion", { token, body: { password: "wrong" }, headers: { "idempotency-key": "delete-0001" } })).status).toBe(422);

    await h.superuser.$executeRawUnsafe("INSERT INTO wallet.wallet_accounts (owner_type, owner_id, balance) VALUES ('CUSTOMER', $1::uuid, 5000)", customer.id);
    await h.superuser.$executeRawUnsafe("INSERT INTO betting.bets (user_id, channel, stake, status) VALUES ($1::uuid, 'ONLINE', 1000, 'PENDING')", customer.id);
    await h.superuser.$executeRawUnsafe("INSERT INTO wallet.payments (user_id, direction, status, amount) VALUES ($1::uuid, 'WITHDRAWAL', 'PROCESSING', 1000)", customer.id);

    const requested = await h.call<AccountDeletion>("POST", "/account/deletion", {
      token,
      body: { password: PASSWORD, reason: "Taking a break" },
      headers: { "idempotency-key": "delete-0001" },
    });

    expect(requested.status).toBe(200);
    expect(accountDeletionSchema.parse(requested.body)).toMatchObject({ status: "PENDING", cancellable: true });
    expect(requested.body.blockers).toHaveLength(3);
    expect(Date.parse(requested.body.scheduledFor ?? "")).toBeGreaterThan(Date.now() + 13 * 86_400_000);

    const replayed = await h.call<AccountDeletion>("POST", "/account/deletion", {
      token,
      body: { password: PASSWORD },
      headers: { "idempotency-key": "delete-0001" },
    });

    expect(replayed.body.requestedAt).toBe(requested.body.requestedAt);
    expect(await h.prisma.accountDeletion.count({ where: { customerId: customer.id } })).toBe(1);

    const check = await h.rpc<{ allowed: boolean; code?: string }>("limits.check", { userId: customer.id, action: "DEPOSIT", amount: 100 });

    expect(check.result).toMatchObject({ allowed: false, code: "ACCOUNT_RESTRICTED" });

    const cancelled = await h.call<AccountDeletion>("DELETE", "/account/deletion", { token });

    expect(cancelled.body).toMatchObject({ status: "CANCELLED", cancellable: false });
    expect((await h.call("DELETE", "/account/deletion", { token })).status).toBe(409);
  });

  it("completes a due deletion only once blockers clear, anonymising personal data and keeping records", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);

    await h.call("POST", "/account/deletion", { token, body: { password: PASSWORD }, headers: { "idempotency-key": "delete-0002" } });
    await h.prisma.accountDeletion.updateMany({ where: { customerId: customer.id }, data: { scheduledFor: new Date(Date.now() - 1000) } });
    await h.superuser.$executeRawUnsafe("INSERT INTO wallet.wallet_accounts (owner_type, owner_id, balance) VALUES ('CUSTOMER', $1::uuid, 2500)", customer.id);

    await completeDueDeletions(h.app.dependencies);
    expect((await h.prisma.accountDeletion.findFirstOrThrow({ where: { customerId: customer.id } })).status).toBe("PENDING");

    await h.superuser.$executeRawUnsafe("UPDATE wallet.wallet_accounts SET balance = 0 WHERE owner_id = $1::uuid", customer.id);
    await redis.client.set(cacheKey(token), "{}", { expiration: { type: "EX", value: 60 } });

    expect(await completeDueDeletions(h.app.dependencies)).toBeGreaterThanOrEqual(1);

    const row = await h.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });

    expect(row.email).toBe(`deleted-${customer.id}@deleted.invalid`);
    expect(row.displayName).toBe("Deleted customer");
    expect(row.phone).toBeNull();
    expect(row.deletedAt).not.toBeNull();
    expect((await h.prisma.accountDeletion.findFirstOrThrow({ where: { customerId: customer.id } })).status).toBe("COMPLETED");
    expect((await h.call("GET", "/auth/me", { token })).status).toBe(401);
    expect(await redis.client.get(cacheKey(token))).toBeNull();
    expect((await h.call("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } })).status).toBe(401);
    expect(await h.prisma.auditLog.count({ where: { entityId: customer.id, action: "customer_deleted", actorId: "system" } })).toBe(1);
  });
});

describe("admin sign-in with ADMIN_TOTP_REQUIRED", () => {
  it("refuses an admin without two-factor authentication and accepts one with it", async () => {
    const deps = h.app.dependencies;
    const handler = new LoginAdminHandler({ ...deps, security: { ...deps.security, adminTotpRequired: true } });
    const plain = await h.makeAdmin("SUPPORT");
    const secured = await h.makeAdmin("SUPER_ADMIN", { totp: true });

    await expect(handler.execute(new LoginAdminCommand({ email: plain.email, password: PASSWORD }, "req-1"))).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });

    const session = await handler.execute(
      new LoginAdminCommand({ email: secured.email, password: PASSWORD, code: generateTotp(secured.secret ?? "", Date.now()) }, "req-2"),
    );

    expect(session.admin.twoFactorEnabled).toBe(true);
    expect(await h.prisma.auditLog.count({ where: { entityId: plain.id, action: "admin_login_failed" } })).toBe(1);
  });

  it("accepts an admin TOTP secret stored encrypted (as the enrolment CLI writes it)", async () => {
    const admin = await h.makeAdmin("SUPPORT");
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

    await h.prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecret: h.app.dependencies.protector.encrypt(secret, adminTotpContext(admin.id)), twoFactorEnabled: true },
    });

    const login = await h.call<{ admin: { twoFactorEnabled: boolean } }>("POST", "/admin/auth/login", {
      body: { email: admin.email, password: PASSWORD, code: generateTotp(secret, Date.now()) },
    });

    expect(login.status).toBe(200);
    expect(login.body.admin.twoFactorEnabled).toBe(true);
  });
});
