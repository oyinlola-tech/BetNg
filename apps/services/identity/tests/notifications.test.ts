import { randomUUID } from "node:crypto";
import { notificationSchema } from "@betng/contracts";
import type { Notification } from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminActor, cashierActor, startHarness } from "./harness.js";
import type { ActorInput, ErrorBody, Harness } from "./harness.js";

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

interface Notified {
  readonly id: string;
  readonly duplicate: boolean;
}

interface Inbox {
  readonly items: readonly Notification[];
}

const customerActor = (id: string): ActorInput => ({ kind: "CUSTOMER", id, role: "CUSTOMER" });

async function notify(customerId: string, extra: Readonly<Record<string, unknown>> = {}): Promise<Notified> {
  const reply = await h.rpc<Notified>("identity.notify", {
    customerId,
    kind: "BET_SETTLED",
    title: "You won ₦1,280.00",
    body: "Your bet won.",
    ...extra,
  });

  if (reply.result === undefined) {
    throw new Error(`identity.notify failed: ${String(reply.error?.code)}`);
  }

  return reply.result;
}

async function inbox(customerId: string, path = `/users/${customerId}/notifications`): Promise<readonly Notification[]> {
  const reply = await h.call<Inbox>("GET", path, { actor: customerActor(customerId) });

  expect(reply.status).toBe(200);

  return reply.body.items;
}

describe("identity.notify", () => {
  it("stores a notification that reads back in the contract shape", async () => {
    const customer = await h.makeCustomer();
    const betId = randomUUID();
    const matchId = randomUUID();

    const created = await notify(customer.id, { data: { betId, matchId, outcome: "WON", payout: 128_000 } });

    expect(created.duplicate).toBe(false);

    const [item] = await inbox(customer.id);

    expect(notificationSchema.safeParse(item).success).toBe(true);
    expect(item).toEqual({
      id: created.id,
      userId: customer.id,
      kind: "BET_SETTLED",
      title: "You won ₦1,280.00",
      body: "Your bet won.",
      read: false,
      betId,
      matchId,
      createdAt: item?.createdAt,
    });
  });

  it("returns a valid payment reference on PAYMENT_UPDATED rows and drops an invalid one", async () => {
    const customer = await h.makeCustomer();
    const payment = { kind: "PAYMENT_UPDATED", title: "Deposit received", body: "₦5,000.00 was added." };
    const good = await notify(customer.id, { ...payment, data: { reference: "BNG_dep-20260922", direction: "DEPOSIT", status: "COMPLETED", amount: 500_000 } });
    const bad = await notify(customer.id, { ...payment, data: { reference: "../../etc", direction: "DEPOSIT", status: "FAILED", amount: 1 } });
    const other = await notify(customer.id, { data: { reference: "BNG_dep-20260922" } });
    const items = await inbox(customer.id);
    const byId = (id: string) => items.find((item) => item.id === id);
    const stored = await h.prisma.notification.findUniqueOrThrow({ where: { id: bad.id } });

    expect(byId(good.id)?.paymentReference).toBe("BNG_dep-20260922");
    expect(notificationSchema.safeParse(byId(good.id)).success).toBe(true);
    expect(byId(bad.id)?.paymentReference).toBeUndefined();
    expect(stored.data).toEqual({ direction: "DEPOSIT", status: "FAILED", amount: 1 });
    expect(byId(other.id)?.paymentReference).toBeUndefined();
  });

  it("is idempotent by dedupeKey, per customer", async () => {
    const customer = await h.makeCustomer();
    const other = await h.makeCustomer();
    const dedupeKey = `settlement:${randomUUID()}`;

    const first = await notify(customer.id, { dedupeKey });
    const repeat = await notify(customer.id, { dedupeKey, title: "A different title" });
    const burst = await Promise.all([1, 2, 3, 4].map(async () => notify(customer.id, { dedupeKey })));
    const elsewhere = await notify(other.id, { dedupeKey });

    expect(first.duplicate).toBe(false);
    expect(repeat).toEqual({ id: first.id, duplicate: true });
    expect(burst.every((reply) => reply.id === first.id && reply.duplicate)).toBe(true);
    expect(elsewhere.duplicate).toBe(false);

    const items = await inbox(customer.id);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("You won ₦1,280.00");
  });

  it("writes a new row each time when there is no dedupeKey", async () => {
    const customer = await h.makeCustomer();

    const first = await notify(customer.id);
    const second = await notify(customer.id);

    expect(second.id).not.toBe(first.id);
    expect(await inbox(customer.id)).toHaveLength(2);
  });

  it("bounds the title, body, data and dedupeKey and refuses unknown keys and kinds", async () => {
    const customer = await h.makeCustomer();
    const base = { customerId: customer.id, kind: "BET_SETTLED", title: "Title", body: "Body" };

    const refused = [
      { ...base, title: "x".repeat(121) },
      { ...base, title: "   " },
      { ...base, body: "x".repeat(241) },
      { ...base, data: { blob: "x".repeat(4_096) } },
      { ...base, data: ["not", "an", "object"] },
      { ...base, dedupeKey: "k".repeat(121) },
      { ...base, dedupeKey: "has spaces" },
      { ...base, kind: "PROMOTION" },
      { ...base, customerId: "not-a-uuid" },
      { ...base, readAt: new Date().toISOString() },
    ];

    for (const payload of refused) {
      const reply = await h.rpc("identity.notify", payload);

      expect(reply.success).toBe(false);
      expect(reply.error?.code).toBe("RPC_VALIDATION_ERROR");
    }

    const accepted = await h.rpc("identity.notify", {
      ...base,
      title: "x".repeat(120),
      body: "x".repeat(240),
      data: { blob: "x".repeat(4_000) },
      dedupeKey: "k".repeat(120),
    });

    expect(accepted.success).toBe(true);
    expect(await inbox(customer.id)).toHaveLength(1);
  });

  it("answers NOT_FOUND for a customer that does not exist", async () => {
    const reply = await h.rpc("identity.notify", {
      customerId: randomUUID(),
      kind: "BET_SETTLED",
      title: "Title",
      body: "Body",
    });

    expect(reply.success).toBe(false);
    expect(reply.error?.code).toBe("NOT_FOUND");
  });

  it("is refused without the internal token", async () => {
    const customer = await h.makeCustomer();

    const response = await fetch("http://127.0.0.1:4110/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: randomUUID(),
        procedure: "identity.notify",
        payload: { customerId: customer.id, kind: "BET_SETTLED", title: "Forged", body: "Forged" },
        metadata: {},
        timestamp: Date.now(),
      }),
    });

    // service-kit hides /rpc from a caller without the token.
    expect(response.status).toBe(404);
    expect(await inbox(customer.id)).toEqual([]);
  });
});

describe("GET /users/:id/notifications", () => {
  it("lists newest first, honours limit and accepts `me`", async () => {
    const customer = await h.makeCustomer();

    for (const title of ["first", "second", "third"]) {
      await notify(customer.id, { title });
    }

    const all = await inbox(customer.id);
    const mine = await inbox(customer.id, "/users/me/notifications");
    const limited = await inbox(customer.id, `/users/${customer.id}/notifications?limit=2`);

    expect(all.map((item) => item.title)).toEqual(["third", "second", "first"]);
    expect(mine).toEqual(all);
    expect(limited.map((item) => item.title)).toEqual(["third", "second"]);
  });

  it("refuses a limit outside 1–100 and unknown query keys", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    for (const query of ["limit=0", "limit=101", "limit=abc", "customerId=x"]) {
      const reply = await h.call<ErrorBody>("GET", `/users/me/notifications?${query}`, { actor });

      expect(reply.status).toBe(422);
      expect(reply.body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("refuses another customer's inbox, staff actors and callers that bypass the gateway", async () => {
    const customer = await h.makeCustomer();
    const victim = await h.makeCustomer();
    const shop = await h.makeShop();
    const cashier = await h.makeCashier(shop, "OWNER");

    await notify(victim.id, { title: "Private" });

    const path = `/users/${victim.id}/notifications`;

    const other = await h.call<ErrorBody>("GET", path, { actor: customerActor(customer.id) });
    const unknown = await h.call<ErrorBody>("GET", `/users/${randomUUID()}/notifications`, {
      actor: customerActor(customer.id),
    });
    const admin = await h.call<ErrorBody>("GET", path, { actor: adminActor("SUPER_ADMIN") });
    const adminAsSelf = await h.call<ErrorBody>("GET", path, { actor: adminActor("SUPER_ADMIN", victim.id) });
    const staff = await h.call<ErrorBody>("GET", path, { actor: cashierActor(cashier) });
    const anonymous = await h.call<ErrorBody>("GET", path);
    const forged = await h.call<ErrorBody>("GET", path, { actor: customerActor(victim.id), internal: false });

    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(other.body)).not.toContain("Private");
    expect(unknown.status).toBe(403);
    expect(admin.status).toBe(403);
    expect(adminAsSelf.status).toBe(403);
    expect(staff.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(forged.status).toBe(401);
  });
});

describe("POST /users/:id/notifications/read", () => {
  it("marks the named notifications and leaves the rest unread", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    const first = await notify(customer.id, { title: "first" });
    const second = await notify(customer.id, { title: "second" });

    await notify(customer.id, { title: "third" });

    const reply = await h.call("POST", `/users/${customer.id}/notifications/read`, {
      actor,
      body: { ids: [first.id, second.id] },
    });

    expect(reply.status).toBe(204);
    expect(reply.body).toBeUndefined();

    const state = Object.fromEntries((await inbox(customer.id)).map((item) => [item.title, item.read]));

    expect(state).toEqual({ first: true, second: true, third: false });
  });

  it("marks everything when no ids are sent, and nothing for an empty list", async () => {
    const customer = await h.makeCustomer();
    const actor = customerActor(customer.id);

    await notify(customer.id);
    await notify(customer.id);

    const none = await h.call("POST", "/users/me/notifications/read", { actor, body: { ids: [] } });

    expect(none.status).toBe(204);
    expect((await inbox(customer.id)).map((item) => item.read)).toEqual([false, false]);

    const all = await h.call("POST", "/users/me/notifications/read", { actor, body: {} });

    expect(all.status).toBe(204);
    expect((await inbox(customer.id)).map((item) => item.read)).toEqual([true, true]);
  });

  it("silently ignores ids that belong to someone else or to nobody", async () => {
    const customer = await h.makeCustomer();
    const victim = await h.makeCustomer();

    const theirs = await notify(victim.id);
    const mine = await notify(customer.id);

    const reply = await h.call("POST", `/users/${customer.id}/notifications/read`, {
      actor: customerActor(customer.id),
      body: { ids: [theirs.id, randomUUID(), mine.id] },
    });
    const foreignOnly = await h.call("POST", `/users/${customer.id}/notifications/read`, {
      actor: customerActor(customer.id),
      body: { ids: [theirs.id] },
    });
    const unknownOnly = await h.call("POST", `/users/${customer.id}/notifications/read`, {
      actor: customerActor(customer.id),
      body: { ids: [randomUUID()] },
    });

    expect(reply.status).toBe(204);
    expect(foreignOnly.status).toBe(204);
    expect(unknownOnly.status).toBe(204);
    expect((await inbox(customer.id))[0]?.read).toBe(true);
    expect((await inbox(victim.id))[0]?.read).toBe(false);
  });

  it("refuses another customer's path, staff actors, oversized and malformed bodies", async () => {
    const customer = await h.makeCustomer();
    const victim = await h.makeCustomer();
    const actor = customerActor(customer.id);

    await notify(victim.id);

    const path = `/users/${victim.id}/notifications/read`;

    const other = await h.call<ErrorBody>("POST", path, { actor, body: {} });
    const admin = await h.call<ErrorBody>("POST", path, { actor: adminActor("SUPER_ADMIN"), body: {} });
    const anonymous = await h.call<ErrorBody>("POST", path, { body: {} });
    const tooMany = await h.call<ErrorBody>("POST", "/users/me/notifications/read", {
      actor,
      body: { ids: Array.from({ length: 101 }, () => randomUUID()) },
    });
    const malformed = await h.call<ErrorBody>("POST", "/users/me/notifications/read", {
      actor,
      body: { ids: ["1 OR 1=1"] },
    });
    const unknownKey = await h.call<ErrorBody>("POST", "/users/me/notifications/read", {
      actor,
      body: { customerId: victim.id },
    });

    expect(other.status).toBe(403);
    expect(admin.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(tooMany.status).toBe(422);
    expect(malformed.status).toBe(422);
    expect(unknownKey.status).toBe(422);
    expect((await inbox(victim.id))[0]?.read).toBe(false);
  });
});

describe("maintenance", () => {
  it("purges notifications older than the cut-off and keeps newer ones", async () => {
    const customer = await h.makeCustomer();

    const old = await notify(customer.id, { title: "old" });

    await notify(customer.id, { title: "recent" });
    await h.prisma.notification.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 31 * 24 * 3_600_000) },
    });

    const purged = await h.store.notifications.purgeOlderThan(new Date(Date.now() - 30 * 24 * 3_600_000));

    expect(purged).toBeGreaterThanOrEqual(1);
    expect((await inbox(customer.id)).map((item) => item.title)).toEqual(["recent"]);
  });
});
