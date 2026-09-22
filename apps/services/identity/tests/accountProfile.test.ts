import type { AdminCustomer, CustomerProfile } from "@betng/contracts";
import { adminCustomerSchema, customerProfileSchema } from "@betng/contracts";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminActor, PASSWORD, signIn, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 });

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function alerts(customerId: string): Promise<readonly string[]> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await h.prisma.notification.findMany({ where: { customerId, kind: "SECURITY_ALERT" } });

    if (rows.length > 0) return rows.map((row) => row.title);

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return [];
}

describe("PATCH /account/profile", () => {
  it("updates the caller's own name and normalised phone, audits it with a masked phone and alerts the customer", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);
    const reply = await h.call<CustomerProfile>("PATCH", "/account/profile", { token, body: { displayName: "  Ada Obi ", phone: "+234 803 555 0142" } });

    expect(reply.status).toBe(200);
    expect(customerProfileSchema.safeParse(reply.body).success).toBe(true);
    expect(reply.body).toMatchObject({ id: customer.id, displayName: "Ada Obi", phone: "+2348035550142" });

    const [audit] = await h.prisma.auditLog.findMany({ where: { entityId: customer.id, action: "customer_profile_updated" } });

    expect(audit?.actorId).toBe(customer.id);
    expect(audit?.after).toEqual({ displayName: "Ada Obi", phone: "***142" });
    expect(JSON.stringify(audit)).not.toContain("8035550142");
    expect(await alerts(customer.id)).toContain("Your BetNG profile was updated");
  });

  it("answers an unchanged request with the current profile and writes nothing", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);
    const reply = await h.call<CustomerProfile>("PATCH", "/account/profile", { token, body: { displayName: customer.displayName } });

    expect(reply.status).toBe(200);
    expect(await h.prisma.auditLog.count({ where: { entityId: customer.id, action: "customer_profile_updated" } })).toBe(0);
  });

  it("refuses an empty change, an unknown field, a bad phone and a caller who is not a customer", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);

    expect((await h.call("PATCH", "/account/profile", { token, body: {} })).status).toBe(422);
    expect((await h.call("PATCH", "/account/profile", { token, body: { displayName: "Ada", email: "x@y.test" } })).status).toBe(422);
    expect((await h.call("PATCH", "/account/profile", { token, body: { phone: "call me" } })).status).toBe(422);
    expect((await h.call("PATCH", "/account/profile", { actor: adminActor("SUPER_ADMIN"), body: { displayName: "Someone" } })).status).toBe(403);
    expect((await h.call("PATCH", "/account/profile", { body: { displayName: "Someone" } })).status).toBe(401);
  });
});

describe("GET /account/export", () => {
  it("returns one JSON object of the caller's identity records with no secrets, files or identity numbers", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);
    const reply = await h.call<Record<string, unknown>>("GET", "/account/export", { token });
    const text = JSON.stringify(reply.body);

    expect(reply.status).toBe(200);
    expect(typeof reply.body === "object" && reply.body !== null && !Array.isArray(reply.body)).toBe(true);
    expect(reply.body).toMatchObject({
      format: "betng.account-export.v1",
      profile: { id: customer.id, email: customer.email },
      security: { twoFactor: { enabled: false } },
      preferences: { pushDevices: [] },
      responsibleGaming: { history: [] },
    });
    expect(Array.isArray(reply.body["notifications"])).toBe(true);
    expect(Array.isArray((reply.body["security"] as { sessions: unknown[] }).sessions)).toBe(true);
    expect(reply.body["exportedAt"]).toEqual(expect.any(String));
    expect(text).not.toContain(customer.passwordHash);
    expect(text).not.toContain(token);
    expect(text).not.toMatch(/"(passwordHash|tokenHash|totpSecret|fileName|storageKey|bvn|nin|identityNumber)":/iu);
  });

  it("is refused without a customer session", async () => {
    expect((await h.call("GET", "/account/export")).status).toBe(401);
    expect((await h.call("GET", "/account/export", { actor: adminActor("SUPER_ADMIN") })).status).toBe(403);
  });
});

describe("PATCH /admin/users/:id", () => {
  it("corrects a customer's details with a reason, audits before and after and answers the AdminCustomer", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const customer = await h.makeCustomer();
    const reply = await h.call<AdminCustomer>("PATCH", `/admin/users/${customer.id}`, {
      actor: admin,
      body: { displayName: "Corrected Name", phone: "0803 555 0199", reason: "Customer called support with ID" },
    });

    expect(reply.status).toBe(200);
    expect(adminCustomerSchema.safeParse(reply.body).success).toBe(true);
    expect(reply.body).toMatchObject({ id: customer.id, displayName: "Corrected Name", phone: "08035550199", balance: 0, openBets: 0 });

    const [audit] = await h.prisma.auditLog.findMany({ where: { entityId: customer.id, action: "customer_profile_updated" } });

    expect(audit).toMatchObject({
      actorId: admin.id,
      reason: "Customer called support with ID",
      severity: "WARNING",
      before: { displayName: "Test Customer", phone: null },
      after: { displayName: "Corrected Name", phone: "***199" },
    });
    expect(await alerts(customer.id)).toContain("Your BetNG profile was updated");
  });

  it("requires a reason, refuses balances and unknown customers", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const customer = await h.makeCustomer();

    expect((await h.call("PATCH", `/admin/users/${customer.id}`, { actor: admin, body: { displayName: "No Reason" } })).status).toBe(422);
    expect((await h.call("PATCH", `/admin/users/${customer.id}`, { actor: admin, body: { balance: 5, reason: "Adjusting it" } })).status).toBe(422);
    expect((await h.call("PATCH", "/admin/users/00000000-0000-4000-8000-000000000001", { actor: admin, body: { displayName: "Ghost", reason: "Nobody here" } })).status).toBe(404);
  });
});

describe("POST /admin/users/:id/password-reset", () => {
  it("emails the customer a working reset code the operator never sees, and audits the request", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const customer = await h.makeCustomer();
    const sent = vi.spyOn(h.app.dependencies.messenger, "sendCode");
    const logsBefore = h.logs.length;
    const reply = await h.call("POST", `/admin/users/${customer.id}/password-reset`, { actor: admin, body: { reason: "Locked out, verified by phone" } });

    expect(reply.status).toBe(204);
    expect(reply.body).toBeUndefined();
    expect(sent).toHaveBeenCalledTimes(1);

    const [to, purpose, code] = sent.mock.calls[0] ?? [];

    expect(to).toBe(customer.email);
    expect(purpose).toBe("password_reset");
    expect(code).toMatch(/^\d{6}$/u);

    const audit = await h.prisma.auditLog.findMany({ where: { entityId: customer.id, action: "customer_password_reset_sent" } });

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: admin.id, reason: "Locked out, verified by phone" });
    expect(JSON.stringify(audit)).not.toContain(String(code));
    expect(h.logs.slice(logsBefore).some((line) => line.includes(String(code)))).toBe(false);
    expect(await alerts(customer.id)).toContain("BetNG support sent you a password reset code");

    const again = await h.call<ErrorBody>("POST", `/admin/users/${customer.id}/password-reset`, { actor: admin, body: { reason: "Second try" } });

    expect(again.status).toBe(409);

    const reset = await h.call("POST", "/auth/password/reset", { body: { email: customer.email, code, newPassword: "a-fresh-long-password" } });

    expect(reset.status).toBe(204);
    expect((await h.call("POST", "/auth/login", { body: { email: customer.email, password: PASSWORD } })).status).toBe(401);
  });

  it("refuses without a reason, for an unverified account and for an unknown customer", async () => {
    const admin = adminActor("SUPER_ADMIN");
    const unverified = await h.makeCustomer({ verified: false });

    expect((await h.call("POST", `/admin/users/${unverified.id}/password-reset`, { actor: admin, body: {} })).status).toBe(422);
    expect((await h.call("POST", `/admin/users/${unverified.id}/password-reset`, { actor: admin, body: { reason: "Please reset" } })).status).toBe(409);
    expect((await h.call("POST", "/admin/users/00000000-0000-4000-8000-000000000002/password-reset", { actor: admin, body: { reason: "Please reset" } })).status).toBe(404);
  });
});

describe("registration password policy", () => {
  it("refuses a short password and one found in the breach corpus", async () => {
    const email = `${crypto.randomUUID()}@example.test`;

    expect((await h.call("POST", "/auth/register", { body: { email, password: "short1", displayName: "Short" } })).status).toBe(422);

    vi.spyOn(h.app.dependencies.breachChecker, "isBreached").mockResolvedValue(true);

    const breached = await h.call<ErrorBody & { error: { details?: { path: string }[] } }>("POST", "/auth/register", {
      body: { email, password: "password1234", displayName: "Breached" },
    });

    expect(breached.status).toBe(422);
    expect(breached.body.error.details?.[0]?.path).toBe("password");
    expect(await h.store.customers.findByEmail(email)).toBeUndefined();
  });
});
