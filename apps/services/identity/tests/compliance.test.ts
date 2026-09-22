import { randomUUID } from "node:crypto";
import type {
  ChannelPreferences,
  IdentityCheckResult,
  KycDocument,
  KycOverview,
  KycReviewItem,
  LimitHistoryEntry,
  LimitsSummary,
  Page,
  PushDevice,
  ResponsibleGamingAccount,
  SelfExclusion,
} from "@betng/contracts";
import {
  channelPreferencesSchema,
  identityCheckResultSchema,
  kycOverviewSchema,
  kycReviewItemSchema,
  kycUploadTicketSchema,
  limitHistoryEntrySchema,
  limitsSummarySchema,
  pushDeviceSchema,
  responsibleGamingAccountSchema,
  selfExclusionSchema,
} from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DocumentStorage } from "../src/interfaces/index.js";
import { IssueKycUploadCommand, IssueKycUploadHandler, SubmitKycDocumentCommand, SubmitKycDocumentHandler } from "../src/services/index.js";
import { createDocumentStorage } from "../src/services/kyc/index.js";
import { adminActor, PASSWORD, resetReadModelFixtures, signIn, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
  await resetReadModelFixtures(h);
});

afterAll(async () => {
  await h.stop();
});

const customerActor = (id: string) => ({ kind: "CUSTOMER" as const, id });

async function payment(userId: string, direction: "DEPOSIT" | "WITHDRAWAL", status: string, amount: number, hoursAgo = 0): Promise<void> {
  await h.superuser.$executeRawUnsafe(
    "INSERT INTO wallet.payments (user_id, direction, status, amount, created_at) VALUES ($1::uuid, $2, $3, $4, now() - make_interval(hours => $5))",
    userId,
    direction,
    status,
    amount,
    hoursAgo,
  );
}

async function check(userId: string, action: "DEPOSIT" | "BET" | "WITHDRAWAL", amount: number): Promise<{ allowed: boolean; code?: string; message?: string }> {
  const reply = await h.rpc<{ allowed: boolean; code?: string; message?: string }>("limits.check", { userId, action, amount });

  if (reply.result === undefined) {
    throw new Error(`limits.check failed: ${JSON.stringify(reply.error)}`);
  }

  return reply.result;
}

describe("responsible-gaming limits", () => {
  it("applies a tighter limit at once and holds a looser one for the cooling-off period", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    const set = await h.call<LimitsSummary>("PUT", "/limits", { actor, body: { kind: "deposit_daily", value: 100_000 } });

    expect(set.status).toBe(200);
    expect(limitsSummarySchema.parse(set.body).limits[0]).toMatchObject({ kind: "deposit_daily", status: "active", value: 100_000, used: 0 });

    const lowered = await h.call<LimitsSummary>("PUT", "/limits", { actor, body: { kind: "deposit_daily", value: 50_000 } });

    expect(lowered.body.limits[0]).toMatchObject({ status: "active", value: 50_000 });

    const raised = await h.call<LimitsSummary>("PUT", "/limits", { actor, body: { kind: "deposit_daily", value: 200_000 } });
    const pending = raised.body.limits[0];

    expect(pending).toMatchObject({ status: "pending", value: 50_000, pendingValue: 200_000 });
    expect(Date.parse(pending?.pendingEffectiveAt ?? "")).toBeGreaterThan(Date.now() + 23 * 3_600_000);

    await h.prisma.responsibleGamingLimit.update({
      where: { customerId_kind: { customerId: customer.id, kind: "deposit_daily" } },
      data: { pendingEffectiveAt: new Date(Date.now() - 1000) },
    });

    const settled = await h.call<LimitsSummary>("GET", "/limits/summary", { actor });

    expect(settled.body.limits[0]).toMatchObject({ status: "active", value: 200_000 });
    expect(settled.body.limits[0]?.pendingValue).toBeUndefined();

    const removal = await h.call<LimitsSummary>("DELETE", "/limits/deposit_daily", { actor });

    expect(removal.body.limits[0]).toMatchObject({ status: "requested", value: 200_000 });
    expect((await h.call("DELETE", "/limits/loss_weekly", { actor })).status).toBe(404);
    expect((await h.call("DELETE", "/limits/nonsense", { actor })).status).toBe(422);
    expect((await h.call("PUT", "/limits", { actor, body: { kind: "session_minutes", value: 5 } })).status).toBe(422);

    const history = await h.call<{ items: LimitHistoryEntry[] }>("GET", "/limits/history", { actor });

    expect(history.body.items.map((entry) => limitHistoryEntrySchema.parse(entry).action)).toEqual(["REMOVED", "RAISED", "LOWERED", "SET"]);
    await expect(h.superuser.$executeRawUnsafe("DELETE FROM identity.rg_limit_history WHERE customer_id = $1::uuid", customer.id)).rejects.toThrow();
  });

  it("answers limits.check from deposits, settled losses, open stakes and session age", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    await h.call("PUT", "/limits", { actor, body: { kind: "deposit_daily", value: 100_000 } });
    await h.call("PUT", "/limits", { actor, body: { kind: "loss_daily", value: 50_000 } });

    await payment(customer.id, "DEPOSIT", "CONFIRMED", 60_000, 2);
    await payment(customer.id, "DEPOSIT", "FAILED", 90_000, 1);
    await payment(customer.id, "DEPOSIT", "CONFIRMED", 90_000, 30);

    expect(await check(customer.id, "DEPOSIT", 40_000)).toEqual({ allowed: true });
    expect(await check(customer.id, "DEPOSIT", 40_001)).toMatchObject({ allowed: false, code: "LIMIT_EXCEEDED" });

    await h.superuser.$executeRawUnsafe(
      `INSERT INTO betting.bets (user_id, channel, stake, status, payout, settled_at) VALUES
        ($1::uuid, 'ONLINE', 30000, 'LOST', 0, now() - interval '1 hour'),
        ($1::uuid, 'ONLINE', 10000, 'WON', 25000, now() - interval '1 hour'),
        ($1::uuid, 'ONLINE', 20000, 'VOID', 20000, now() - interval '1 hour'),
        ($1::uuid, 'ONLINE', 99000, 'LOST', 0, now() - interval '2 days')`,
      customer.id,
    );
    await h.superuser.$executeRawUnsafe("INSERT INTO betting.bets (user_id, channel, stake, status) VALUES ($1::uuid, 'ONLINE', 10000, 'PENDING')", customer.id);

    expect(await check(customer.id, "BET", 25_000)).toEqual({ allowed: true });
    expect(await check(customer.id, "BET", 25_001)).toMatchObject({ allowed: false, code: "LIMIT_EXCEEDED" });
    expect(await check(customer.id, "WITHDRAWAL", 10_000_000)).toEqual({ allowed: true });

    const summary = await h.call<LimitsSummary>("GET", "/limits/summary", { actor });
    const loss = summary.body.limits.find((limit) => limit.kind === "loss_daily");
    const deposit = summary.body.limits.find((limit) => limit.kind === "deposit_daily");

    expect(loss?.used).toBe(15_000);
    expect(deposit?.used).toBe(60_000);
    expect(Date.parse(deposit?.resetsAt ?? "")).toBeGreaterThan(Date.now() + 21 * 3_600_000);

    await h.call("PUT", "/limits", { actor, body: { kind: "session_minutes", value: 30 } });
    await signIn(h, customer.email);
    expect(await check(customer.id, "BET", 1)).toEqual({ allowed: true });

    await h.prisma.session.updateMany({ where: { subjectId: customer.id }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await check(customer.id, "BET", 1)).toMatchObject({ allowed: false, code: "LIMIT_EXCEEDED" });
    expect(await check(customer.id, "DEPOSIT", 1)).toMatchObject({ allowed: false, code: "LIMIT_EXCEEDED" });
    expect(await check(customer.id, "WITHDRAWAL", 1)).toEqual({ allowed: true });

    await h.prisma.session.updateMany({ where: { subjectId: customer.id }, data: { createdAt: new Date() } });
    expect(await check(customer.id, "BET", 1)).toEqual({ allowed: true });

    expect(await h.prisma.limitCheckRefusal.count({ where: { customerId: customer.id } })).toBeGreaterThanOrEqual(3);
  });

  it("self-excludes after a password check, refuses deposits and bets, still allows withdrawals", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    expect((await h.call("POST", "/limits/self-exclude", { actor, body: { period: "7d", password: "wrong-password" } })).status).toBe(422);

    const excluded = await h.call<SelfExclusion>("POST", "/limits/self-exclude", { actor, body: { period: "7d", password: PASSWORD } });

    expect(excluded.status).toBe(200);
    expect(selfExclusionSchema.parse(excluded.body)).toMatchObject({ active: true, period: "7d" });
    expect(excluded.body.canCancelAt).toBe(excluded.body.endsAt);

    expect(await check(customer.id, "DEPOSIT", 100)).toMatchObject({ allowed: false, code: "SELF_EXCLUDED" });
    expect(await check(customer.id, "BET", 100)).toMatchObject({ allowed: false, code: "SELF_EXCLUDED" });
    expect(await check(customer.id, "WITHDRAWAL", 100)).toEqual({ allowed: true });
    expect((await h.call<LimitsSummary>("GET", "/limits/summary", { actor })).body.restricted).toBe(true);
    expect((await h.call("DELETE", "/limits/self-exclude", { actor })).status).toBe(409);
    expect((await h.call("POST", "/limits/self-exclude", { actor, body: { period: "24h", password: PASSWORD } })).status).toBe(409);
    expect((await h.call("POST", "/limits/self-exclude", { actor, body: { period: "30d", password: PASSWORD } })).status).toBe(200);

    await h.prisma.selfExclusion.updateMany({ where: { customerId: customer.id }, data: { endsAt: new Date(Date.now() - 1000), canCancelAt: new Date(Date.now() - 1000) } });

    expect((await h.call<SelfExclusion>("DELETE", "/limits/self-exclude", { actor })).body).toEqual({ active: false });
    expect(await check(customer.id, "DEPOSIT", 100)).toEqual({ allowed: true });
  });

  it("refuses everything for a suspended or unknown account", async () => {
    const customer = await h.makeCustomer();

    await h.prisma.customer.update({ where: { id: customer.id }, data: { status: "SUSPENDED" } });

    for (const action of ["DEPOSIT", "BET", "WITHDRAWAL"] as const) {
      expect(await check(customer.id, action, 100)).toMatchObject({ allowed: false, code: "ACCOUNT_RESTRICTED" });
    }

    expect(await check(randomUUID(), "DEPOSIT", 100)).toMatchObject({ allowed: false, code: "ACCOUNT_RESTRICTED" });
    expect((await h.rpc("limits.check", { userId: customer.id, action: "DEPOSIT", amount: 1.5 })).success).toBe(false);
  });

  it("lists flagged accounts for admins with users:read only", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    await h.call("POST", "/limits/self-exclude", { actor, body: { period: "24h", password: PASSWORD } });
    await check(customer.id, "BET", 100);

    const forbidden = await h.call<ErrorBody>("GET", "/admin/responsible-gaming", { actor: adminActor("OPERATIONS") });

    expect(forbidden.status).toBe(403);

    const page = await h.call<Page<ResponsibleGamingAccount>>("GET", `/admin/responsible-gaming?search=${encodeURIComponent(customer.email)}`, {
      actor: adminActor("SUPPORT"),
    });

    expect(page.status).toBe(200);
    expect(page.body.total).toBe(1);

    const account = responsibleGamingAccountSchema.parse(page.body.items[0]);

    expect(account.flags).toEqual(expect.arrayContaining(["SELF_EXCLUDED", "LIMIT_BREACH_ATTEMPT"]));
    expect(account.restricted).toBe(true);

    const filtered = await h.call<Page<ResponsibleGamingAccount>>("GET", "/admin/responsible-gaming?flag=SELF_EXCLUDED&pageSize=100", { actor: adminActor("SUPER_ADMIN") });

    expect(filtered.body.items.every((item) => item.flags.includes("SELF_EXCLUDED"))).toBe(true);
  });
});

describe("KYC", () => {
  it("refuses an upload ticket with 503 while storage is not configured", async () => {
    const customer = await h.makeCustomer();
    const reply = await h.call<ErrorBody>("POST", "/kyc/documents/uploads", {
      actor: customerActor(customer.id),
      body: { type: "PASSPORT", fileName: "passport.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
    });

    expect(reply.status).toBe(503);
    expect(reply.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(await h.prisma.kycUpload.count({ where: { customerId: customer.id } })).toBe(0);
    expect((await h.call("POST", "/kyc/documents", { actor: customerActor(customer.id), body: { uploadId: randomUUID() } })).status).toBe(503);
  });

  it("issues a size- and type-bound SigV4 ticket and accepts the document only after verifying the stored object", async () => {
    const customer = await h.makeCustomer();
    const caller = { token: undefined, actorId: customer.id, requestId: "kyc-test" };
    const signer = createDocumentStorage({
      endpoint: "https://storage.example.com",
      region: "eu-west-1",
      bucket: "betng-kyc",
      accessKeyId: "AKIDEXAMPLE0001",
      secretAccessKey: "secret-key-for-signature-tests",
      forcePathStyle: true,
    });

    const objects = new Map<string, { size: number; type: string; prefix: Buffer }>();
    const storage: DocumentStorage = {
      presignPut: (key, type, size, expires) => signer.presignPut(key, type, size, expires),
      presignGet: (key, expires) => signer.presignGet(key, expires),
      head: async (key) => {
        const object = objects.get(key);

        return object === undefined ? { exists: false } : { exists: true, sizeBytes: object.size, contentType: object.type };
      },
      readPrefix: async (key) => objects.get(key)?.prefix ?? Buffer.alloc(0),
    };

    const deps = { ...h.app.dependencies, storage };
    const ticket = await new IssueKycUploadHandler(deps).execute(
      new IssueKycUploadCommand(caller, { type: "PASSPORT", fileName: "passport.png", contentType: "image/png", sizeBytes: 4096 }),
    );

    kycUploadTicketSchema.parse(ticket);

    const url = new URL(ticket.uploadUrl);

    expect(url.host).toBe("storage.example.com");
    expect(url.pathname).toBe(`/betng-kyc/kyc/${customer.id}/${ticket.uploadId}`);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(ticket.headers).toEqual({ "Content-Type": "image/png" });
    expect(ticket.uploadUrl).not.toContain("passport");

    const submit = new SubmitKycDocumentHandler(deps);
    const key = `kyc/${customer.id}/${ticket.uploadId}`;

    await expect(submit.execute(new SubmitKycDocumentCommand(caller, ticket.uploadId))).rejects.toMatchObject({ statusCode: 422 });

    objects.set(key, { size: 4000, type: "image/png", prefix: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
    await expect(submit.execute(new SubmitKycDocumentCommand(caller, ticket.uploadId))).rejects.toMatchObject({ statusCode: 422 });

    objects.set(key, { size: 4096, type: "image/png", prefix: Buffer.from("MZ\x90\x00\x03\x00\x00\x00") });
    await expect(submit.execute(new SubmitKycDocumentCommand(caller, ticket.uploadId))).rejects.toMatchObject({ statusCode: 422 });

    objects.set(key, { size: 4096, type: "image/png", prefix: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });

    const document = await submit.execute(new SubmitKycDocumentCommand(caller, ticket.uploadId));

    expect(document).toMatchObject({ type: "PASSPORT", status: "PENDING", fileName: "passport.png", sizeBytes: 4096 });
    await expect(submit.execute(new SubmitKycDocumentCommand(caller, ticket.uploadId))).rejects.toMatchObject({ statusCode: 404 });

    const listed = await h.call<{ items: KycDocument[] }>("GET", "/kyc/documents", { actor: customerActor(customer.id) });

    expect(listed.body.items).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain("kyc/");
  });

  it("verifies BVN and NIN through the sandbox without ever echoing or storing the number", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);
    const digits = (count: number): string => Array.from({ length: count }, () => String(Math.floor(Math.random() * 10))).join("");
    const bvn = `2${digits(6)}5678`;
    const nin = `0${digits(10)}`;

    const verified = await h.call<IdentityCheckResult>("POST", "/kyc/verify/bvn", { actor, body: { bvn, dateOfBirth: "1990-04-01" } });

    expect(identityCheckResultSchema.parse(verified.body)).toMatchObject({ check: "BVN", status: "VERIFIED" });

    const rejected = await h.call<IdentityCheckResult>("POST", "/kyc/verify/nin", { actor, body: { nin, dateOfBirth: "1990-04-01" } });

    expect(rejected.body).toMatchObject({ check: "NIN", status: "REJECTED" });

    const minor = await h.call<IdentityCheckResult>("POST", "/kyc/verify/nin", { actor, body: { nin: `3${digits(10)}`, dateOfBirth: `${String(new Date().getUTCFullYear() - 10)}-01-01` } });

    expect(minor.body.status).toBe("REJECTED");
    expect((await h.call("POST", "/kyc/verify/bvn", { actor, body: { bvn: "123", dateOfBirth: "1990-04-01" } })).status).toBe(422);

    const other = await h.makeCustomer();
    const duplicate = await h.call<IdentityCheckResult>("POST", "/kyc/verify/bvn", { actor: customerActor(other.id), body: { bvn, dateOfBirth: "1990-04-01" } });

    expect(duplicate.body.status).toBe("REJECTED");

    const stored = await h.prisma.kycIdentityCheck.findMany({ where: { customerId: { in: [customer.id, other.id] } } });
    const everything = JSON.stringify([verified.body, rejected.body, duplicate.body, stored, await h.prisma.auditLog.findMany({ where: { entityId: customer.id } })]);

    expect(everything).not.toContain(bvn);
    expect(everything).not.toContain(nin);
    expect(stored.find((row) => row.check === "BVN" && row.customerId === customer.id)?.numberLast4).toBe("5678");
    expect(h.logs.join("\n")).not.toContain(bvn);

    const overview = await h.call<KycOverview>("GET", "/kyc/status", { actor });

    expect(kycOverviewSchema.parse(overview.body)).toMatchObject({ tier: "TIER_1", limits: { dailyDeposit: 20_000_000, dailyWithdrawal: 10_000_000 } });

    const rpc = await h.rpc<{ status: string; tier: string; dailyDeposit: number }>("kyc.status", { userId: customer.id });

    expect(rpc.result).toMatchObject({ tier: "TIER_1", dailyDeposit: 20_000_000, dailyWithdrawal: 10_000_000 });
    expect((await h.rpc("kyc.status", { userId: randomUUID() })).error?.code).toBe("NOT_FOUND");
  });

  it("lets only kyc:write admins decide, requires a reason, audits the decision and previews need storage", async () => {
    const customer = await h.makeCustomer();

    await h.prisma.kycDocument.create({
      data: { customerId: customer.id, type: "NATIONAL_ID", fileName: "id.pdf", contentType: "application/pdf", sizeBytes: 900, objectKey: `kyc/${customer.id}/${randomUUID()}` },
    });

    const queue = await h.call<Page<KycReviewItem>>("GET", `/admin/kyc/pending?search=${encodeURIComponent(customer.email)}`, { actor: adminActor("SUPPORT") });

    expect(queue.status).toBe(200);
    expect(kycReviewItemSchema.parse(queue.body.items[0])).toMatchObject({ userId: customer.id, status: "PENDING" });

    const path = `/admin/kyc/review/${customer.id}`;

    expect((await h.call("POST", path, { actor: adminActor("SUPPORT"), body: { decision: "APPROVE", reason: "Looks right" } })).status).toBe(403);
    expect((await h.call("POST", path, { actor: adminActor("RISK_ANALYST"), body: { decision: "APPROVE", reason: "Looks right" } })).status).toBe(403);
    expect((await h.call("POST", path, { actor: adminActor("SUPER_ADMIN"), body: { decision: "APPROVE" } })).status).toBe(422);
    expect((await h.call("POST", path, { actor: adminActor("SUPER_ADMIN"), body: { decision: "APPROVE", reason: "no" } })).status).toBe(422);
    expect((await h.call("POST", path, { actor: { kind: "CUSTOMER", id: customer.id }, body: { decision: "APPROVE", reason: "Looks right" } })).status).toBe(403);

    const reviewer = adminActor("SUPER_ADMIN");
    const approved = await h.call<KycReviewItem>("POST", path, { actor: reviewer, body: { decision: "APPROVE", reason: "Document matches the profile" } });

    expect(approved.status).toBe(200);
    expect(approved.body.documents[0]?.status).toBe("VERIFIED");
    expect(approved.body.tier).toBe("TIER_1");
    expect(await h.prisma.auditLog.count({ where: { action: "kyc_reviewed", entityId: customer.id, actorId: reviewer.id ?? "" } })).toBe(1);
    expect((await h.call("POST", path, { actor: reviewer, body: { decision: "REJECT", reason: "Second look" } })).status).toBe(409);

    const document = await h.prisma.kycDocument.findFirstOrThrow({ where: { customerId: customer.id } });
    const preview = await h.call<ErrorBody>("GET", `/admin/kyc/documents/${document.id}/preview`, { actor: adminActor("SUPPORT") });

    expect(preview.status).toBe(503);
    expect((await h.call("GET", `/admin/kyc/documents/${document.id}/preview`, { actor: adminActor("OPERATIONS") })).status).toBe(403);
  });
});

describe("identity's own notices and the new notification kinds", () => {
  it("accepts PAYMENT_UPDATED from wallet, and stores SECURITY_ALERT, KYC_UPDATED and a once-a-day LIMIT_WARNING", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    const payment = await h.rpc<{ id: string; duplicate: boolean }>("identity.notify", {
      customerId: customer.id,
      kind: "PAYMENT_UPDATED",
      title: "Deposit confirmed",
      body: "₦5,000.00 was added to your wallet.",
      dedupeKey: `payment:${randomUUID()}`,
    });

    expect(payment.result?.duplicate).toBe(false);

    await signIn(h, customer.email);
    await h.call("PUT", "/limits", { actor, body: { kind: "deposit_daily", value: 1000 } });
    await check(customer.id, "DEPOSIT", 5000);
    await check(customer.id, "DEPOSIT", 5000);

    await h.prisma.kycDocument.create({
      data: { customerId: customer.id, type: "PASSPORT", fileName: "p.pdf", contentType: "application/pdf", sizeBytes: 100, objectKey: `kyc/${customer.id}/${randomUUID()}` },
    });
    await h.call("POST", `/admin/kyc/review/${customer.id}`, { actor: adminActor("SUPER_ADMIN"), body: { decision: "REQUEST_ACTION", reason: "The photo is blurred" } });

    await vi.waitFor(async () => {
      const kinds = (await h.prisma.notification.findMany({ where: { customerId: customer.id } })).map((row) => row.kind).sort();

      expect(kinds).toEqual(["KYC_UPDATED", "LIMIT_WARNING", "PAYMENT_UPDATED", "SECURITY_ALERT"]);
    });

    const kyc = await h.prisma.notification.findFirstOrThrow({ where: { customerId: customer.id, kind: "KYC_UPDATED" } });

    expect(kyc.body).toBe("The photo is blurred");
  });
});

describe("notification channels and push devices", () => {
  it("keeps security email locked on and stores preferences per customer", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);
    const initial = await h.call<ChannelPreferences>("GET", "/notifications/preferences", { actor });

    expect(channelPreferencesSchema.parse(initial.body).locked).toEqual(["email.security"]);
    expect(initial.body.channels.email.security).toBe(true);

    const off = structuredClone(initial.body.channels);

    off.email.security = false;
    expect((await h.call("PUT", "/notifications/preferences", { actor, body: { channels: off } })).status).toBe(422);

    const changed = structuredClone(initial.body.channels);

    changed.sms.marketing = true;
    changed.push.matches = false;

    const saved = await h.call<ChannelPreferences>("PUT", "/notifications/preferences", { actor, body: { channels: changed } });

    expect(saved.body.channels.sms.marketing).toBe(true);
    expect((await h.call<ChannelPreferences>("GET", "/notifications/preferences", { actor })).body.channels.push.matches).toBe(false);
  });

  it("registers push devices with the token hashed and encrypted, never returned", async () => {
    const customer = await h.makeCustomer();
    const { token } = await signIn(h, customer.email);
    const pushToken = `fcm-token-${randomUUID()}`;

    const registered = await h.call<PushDevice>("POST", "/notifications/push/register", { token, body: { platform: "android", token: pushToken, label: "Pixel 8" } });

    expect(registered.status).toBe(200);
    expect(pushDeviceSchema.parse(registered.body)).toMatchObject({ platform: "android", label: "Pixel 8", current: true });
    expect(JSON.stringify(registered.body)).not.toContain(pushToken);

    const row = await h.prisma.pushDevice.findUniqueOrThrow({ where: { id: registered.body.id } });

    expect(row.tokenHash).not.toContain(pushToken);
    expect(row.tokenCiphertext).not.toContain(pushToken);

    const other = await h.makeCustomer();

    expect((await h.call("DELETE", `/notifications/push/devices/${registered.body.id}`, { actor: customerActor(other.id) })).status).toBe(404);
    expect((await h.call<{ items: PushDevice[] }>("GET", "/notifications/push/devices", { token })).body.items).toHaveLength(1);
    expect((await h.call("DELETE", `/notifications/push/devices/${registered.body.id}`, { token })).status).toBe(204);
    expect((await h.call<{ items: PushDevice[] }>("GET", "/notifications/push/devices", { token })).body.items).toHaveLength(0);
  });

  it("refuses a caller that is neither the token holder nor a customer actor", async () => {
    expect((await h.call("GET", "/notifications/preferences")).status).toBe(401);
    expect((await h.call("GET", "/notifications/preferences", { actor: adminActor("SUPER_ADMIN") })).status).toBe(403);
    expect((await h.call("GET", "/limits/summary", { actor: customerActor(randomUUID()) })).status).toBe(401);
    expect((await h.call("GET", "/kyc/status", { actor: customerActor(randomUUID()), internal: false })).status).toBe(401);
  });
});
