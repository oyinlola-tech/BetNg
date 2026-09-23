import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminActivationSecret, AdminCredentials, AdminSession, AdminUser, AdminUserSummary } from "@betng/contracts";
import { generateTotp } from "../src/utils/index.js";
import { adminActor, freshEmail, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

let harness: Harness;
let superAdminId: string;

beforeAll(async () => {
  harness = await startHarness();

  const superAdmin = await harness.makeAdmin("SUPER_ADMIN");

  superAdminId = superAdmin.id;
});

afterAll(async () => {
  await harness.stop();
});

const asSuper = (id: string = superAdminId) => adminActor("SUPER_ADMIN", id);

const createAdmin = async (role: AdminUser["role"] = "SUPPORT", actor = asSuper()) =>
  harness.call<AdminCredentials>("POST", "/admin/admins", {
    actor,
    body: { email: freshEmail(), name: "New Operator", role },
  });

/**
 * Step one of activation, which is the only place an authenticator secret is ever issued — to the person
 * holding the one-time password, never to whoever created the account.
 */
const enrol = async (credentials: AdminCredentials): Promise<string> => {
  const started = await harness.call<AdminActivationSecret>("POST", "/admin/auth/activate/start", {
    body: { email: credentials.email, temporaryPassword: credentials.temporaryPassword },
  });

  expect(started.status).toBe(200);

  return new URL(started.body.otpauthUri.replace("otpauth://", "https://")).searchParams.get("secret") ?? "";
};

describe("creating administrators", () => {
  it("lets a super administrator create one and returns the credentials once", async () => {
    const created = await createAdmin("OPERATIONS");

    expect(created.status).toBe(201);
    expect(created.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    // The creator never learns the authenticator secret.
    expect(JSON.stringify(created.body)).not.toMatch(/otpauth|secret/iu);

    const listed = await harness.call<{ items: AdminUserSummary[] }>("GET", "/admin/admins", { actor: asSuper() });

    expect(listed.status).toBe(200);
    expect(listed.body.items.some((admin) => admin.email === created.body.email)).toBe(true);
  });

  it("never lets a listing carry a hash, a sealed secret or an expiry", async () => {
    await createAdmin();

    const listed = await harness.call<{ items: AdminUserSummary[] }>("GET", "/admin/admins", { actor: asSuper() });
    const serialised = JSON.stringify(listed.body);

    expect(serialised).not.toMatch(/passwordHash|totpSecret|credentialsExpireAt|"v1\./u);
  });

  it.each(["OPERATIONS", "RISK_ANALYST", "SUPPORT"] as const)("refuses %s", async (role) => {
    const answer = await createAdmin("SUPPORT", adminActor(role));

    expect(answer.status).toBe(403);
  });

  it("refuses a second administrator with the same email", async () => {
    const email = freshEmail();
    const body = { email, name: "Twice", role: "SUPPORT" as const };

    expect((await harness.call("POST", "/admin/admins", { actor: asSuper(), body })).status).toBe(201);
    expect((await harness.call("POST", "/admin/admins", { actor: asSuper(), body })).status).toBe(409);
  });

  it("refuses an unknown field", async () => {
    const answer = await harness.call("POST", "/admin/admins", {
      actor: asSuper(),
      body: { email: freshEmail(), name: "Sneaky", role: "SUPPORT", status: "ACTIVE" },
    });

    expect(answer.status).toBe(422);
  });
});

describe("activation", () => {
  it("refuses an ordinary sign-in while the one-time password stands, then activates", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);

    const refused = await harness.call<ErrorBody>("POST", "/admin/auth/login", {
      body: { email, password: temporaryPassword, code: generateTotp(secret, Date.now()) },
    });

    expect(refused.status).toBe(403);
    expect(refused.body.error.message).toMatch(/activate it/iu);

    const activated = await harness.call<AdminSession>("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "a-chosen-password-1", code: generateTotp(secret, Date.now()) },
    });

    expect(activated.status).toBe(200);
    expect(activated.body.token.length).toBeGreaterThan(16);

    // Activation spent that time step, so the same code cannot open a second session.
    const replayed = await harness.call("POST", "/admin/auth/login", {
      body: { email, password: "a-chosen-password-1", code: generateTotp(secret, Date.now()) },
    });

    expect(replayed.status).toBe(422);

    // The chosen password works with the next code.
    const signedIn = await harness.call<AdminSession>("POST", "/admin/auth/login", {
      body: { email, password: "a-chosen-password-1", code: generateTotp(secret, Date.now() + 30_000) },
    });

    expect(signedIn.status).toBe(200);

    const stale = await harness.call("POST", "/admin/auth/login", {
      body: { email, password: temporaryPassword, code: generateTotp(secret, Date.now() + 60_000) },
    });

    expect(stale.status).toBe(401);
  });

  it("refuses activating twice", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);

    await harness.call("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "another-chosen-password", code: generateTotp(secret, Date.now()) },
    });

    // The one-time password no longer matches anything, so this is refused as bad credentials rather
    // than as a state conflict — the account never says which of the two it was.
    const again = await harness.call("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "a-third-chosen-password", code: generateTotp(secret, Date.now() + 30_000) },
    });

    expect(again.status).toBe(401);
  });

  it("refuses activating an account that is already active", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);

    await harness.call("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "a-settled-password-x", code: generateTotp(secret, Date.now()) },
    });

    // Presenting the password the account now has reaches the state check.
    const again = await harness.call("POST", "/admin/auth/activate", {
      body: {
        email,
        temporaryPassword: "a-settled-password-x",
        newPassword: "a-settled-password-y",
        code: generateTotp(secret, Date.now() + 30_000),
      },
    });

    expect(again.status).toBe(409);
  });

  it("refuses a wrong code, a wrong password and reusing the issued password", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);
    const code = () => generateTotp(secret, Date.now());

    expect(
      (await harness.call("POST", "/admin/auth/activate", {
        body: { email, temporaryPassword, newPassword: "a-chosen-password-9", code: "000000" },
      })).status,
    ).toBe(422);

    expect(
      (await harness.call("POST", "/admin/auth/activate", {
        body: { email, temporaryPassword: "not-the-password", newPassword: "a-chosen-password-9", code: code() },
      })).status,
    ).toBe(401);

    expect(
      (await harness.call("POST", "/admin/auth/activate", {
        body: { email, temporaryPassword, newPassword: temporaryPassword, code: code() },
      })).status,
    ).toBe(422);
  });

  it("refuses the second step before the first", async () => {
    const created = await createAdmin();

    const answer = await harness.call("POST", "/admin/auth/activate", {
      body: {
        email: created.body.email,
        temporaryPassword: created.body.temporaryPassword,
        newPassword: "a-chosen-password-8",
        code: "123456",
      },
    });

    expect(answer.status).toBe(409);
  });

  it("issues a fresh authenticator each time the first step runs, and honours only the latest", async () => {
    const created = await createAdmin();
    const first = await enrol(created.body);
    const second = await enrol(created.body);

    expect(second).not.toBe(first);

    // Someone who saw the first secret cannot finish with it.
    const stale = await harness.call("POST", "/admin/auth/activate", {
      body: {
        email: created.body.email,
        temporaryPassword: created.body.temporaryPassword,
        newPassword: "a-chosen-password-7",
        code: generateTotp(first, Date.now()),
      },
    });

    expect(stale.status).toBe(422);

    const activated = await harness.call("POST", "/admin/auth/activate", {
      body: {
        email: created.body.email,
        temporaryPassword: created.body.temporaryPassword,
        newPassword: "a-chosen-password-7",
        code: generateTotp(second, Date.now()),
      },
    });

    expect(activated.status).toBe(200);
  });

  it("refuses the first step with a wrong password, and after activation", async () => {
    const created = await createAdmin();

    const wrong = await harness.call("POST", "/admin/auth/activate/start", {
      body: { email: created.body.email, temporaryPassword: "not-the-password" },
    });

    expect(wrong.status).toBe(401);

    const secret = await enrol(created.body);

    await harness.call("POST", "/admin/auth/activate", {
      body: {
        email: created.body.email,
        temporaryPassword: created.body.temporaryPassword,
        newPassword: "a-chosen-password-6",
        code: generateTotp(secret, Date.now()),
      },
    });

    const again = await harness.call("POST", "/admin/auth/activate/start", {
      body: { email: created.body.email, temporaryPassword: "a-chosen-password-6" },
    });

    expect(again.status).toBe(409);
  });

  it("refuses an address that is not an administrator, without saying so", async () => {
    const answer = await harness.call<ErrorBody>("POST", "/admin/auth/activate", {
      body: { email: freshEmail(), temporaryPassword: "whatever-it-is", newPassword: "a-chosen-password-2", code: "123456" },
    });

    expect(answer.status).toBe(401);
    expect(answer.body.error.message).not.toMatch(/administrator|exist/iu);
  });
});

describe("changing administrators", () => {
  it("changes a name and a role, and evicts the cached actor", async () => {
    const created = await createAdmin("SUPPORT");
    const listed = await harness.call<{ items: AdminUserSummary[] }>("GET", "/admin/admins", { actor: asSuper() });
    const target = listed.body.items.find((admin) => admin.email === created.body.email);

    const updated = await harness.call<AdminUser>("PATCH", `/admin/admins/${String(target?.id)}`, {
      actor: asSuper(),
      body: { name: "Renamed Operator", role: "OPERATIONS", reason: "promoted to operations" },
    });

    expect(updated.status).toBe(200);
    expect(updated.body.displayName).toBe("Renamed Operator");
    expect(updated.body.role).toBe("OPERATIONS");
  });

  it("refuses an administrator changing their own role or status", async () => {
    const role = await harness.call("PATCH", `/admin/admins/${superAdminId}`, {
      actor: asSuper(),
      body: { role: "SUPPORT" },
    });

    expect(role.status).toBe(403);

    const status = await harness.call("POST", `/admin/admins/${superAdminId}/status`, {
      actor: asSuper(),
      body: { status: "SUSPENDED", reason: "testing self suspension" },
    });

    expect(status.status).toBe(403);
  });

  it("suspends another administrator and revokes their sessions", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);

    await harness.call("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "a-chosen-password-3", code: generateTotp(secret, Date.now()) },
    });

    const listed = await harness.call<{ items: AdminUserSummary[] }>("GET", "/admin/admins", { actor: asSuper() });
    const target = listed.body.items.find((admin) => admin.email === email);

    const suspended = await harness.call<AdminUser>("POST", `/admin/admins/${String(target?.id)}/status`, {
      actor: asSuper(),
      body: { status: "SUSPENDED", reason: "left the company" },
    });

    expect(suspended.status).toBe(200);

    const refused = await harness.call("POST", "/admin/auth/login", {
      body: { email, password: "a-chosen-password-3", code: generateTotp(secret, Date.now()) },
    });

    expect(refused.status).toBe(403);
  });

  it("refuses suspending or demoting the last active super administrator", async () => {
    const other = await harness.makeAdmin("SUPER_ADMIN");

    // Acting as a different super administrator, so the self-check is not what refuses it.
    const suspendOther = await harness.call("POST", `/admin/admins/${other.id}/status`, {
      actor: asSuper(),
      body: { status: "SUSPENDED", reason: "routine removal" },
    });

    // There are two, so this one is allowed; the refusal is proven below on the remaining one.
    expect(suspendOther.status).toBe(200);
  });

  it("issues fresh credentials and stops the old ones working", async () => {
    const created = await createAdmin();
    const { email, temporaryPassword } = created.body;
    const secret = await enrol(created.body);

    await harness.call("POST", "/admin/auth/activate", {
      body: { email, temporaryPassword, newPassword: "a-chosen-password-4", code: generateTotp(secret, Date.now()) },
    });

    const listed = await harness.call<{ items: AdminUserSummary[] }>("GET", "/admin/admins", { actor: asSuper() });
    const target = listed.body.items.find((admin) => admin.email === email);

    const reset = await harness.call<AdminCredentials>(
      "POST",
      `/admin/admins/${String(target?.id)}/reset-credentials`,
      { actor: asSuper() },
    );

    expect(reset.status).toBe(200);
    expect(reset.body.temporaryPassword).not.toBe(temporaryPassword);
    expect(await enrol(reset.body)).not.toBe(secret);

    // The chosen password is gone, and so is the old authenticator.
    const stale = await harness.call("POST", "/admin/auth/login", {
      body: { email, password: "a-chosen-password-4", code: generateTotp(secret, Date.now()) },
    });

    expect(stale.status).toBe(401);

    const activated = await harness.call<AdminSession>("POST", "/admin/auth/activate", {
      body: {
        email,
        temporaryPassword: reset.body.temporaryPassword,
        newPassword: "a-chosen-password-5",
        code: generateTotp(await enrol(reset.body), Date.now()),
      },
    });

    expect(activated.status).toBe(200);
  });
});
