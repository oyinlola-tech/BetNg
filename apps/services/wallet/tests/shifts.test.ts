import { randomUUID } from "node:crypto";
import { cashierShiftSchema, depositInitiationSchema } from "@betng/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, createFixtures, errorCode } from "./support.js";
import type { Fixtures } from "./support.js";
import { startPaymentsApp } from "./payments.support.js";
import type { PaymentsApp } from "./payments.support.js";

let fixtures: Fixtures;
let running: PaymentsApp;

beforeAll(async () => {
  fixtures = await createFixtures();
  running = await startPaymentsApp({ PAYMENTS_PROVIDER: "sandbox" });
});

afterAll(async () => {
  await running.stop();
  await fixtures.close();
});

interface Counter {
  readonly shopId: string;
  readonly cashierId: string;
}

async function counter(): Promise<Counter> {
  const shopId = await fixtures.shop();

  return { shopId, cashierId: await fixtures.cashier(shopId, "Bola Cashier") };
}

function cashier(c: Counter, permissions: string[] = ["shifts:operate", "cash:move"]) {
  return { kind: "CASHIER" as const, id: c.cashierId, shopId: c.shopId, permissions };
}

async function open(c: Counter, openingFloat: number, key = `open-${randomUUID()}`) {
  return api("POST", "/api/v1/shop/shifts", { actor: cashier(c), headers: { "idempotency-key": key }, body: { openingFloat } });
}

async function counterEntry(c: Counter, type: "TICKET_SALE" | "TICKET_PAYOUT" | "TICKET_CANCEL", amount: number): Promise<void> {
  await running.rpc.call(type === "TICKET_SALE" ? "wallet.credit" : "wallet.debit", {
    ownerType: "SHOP",
    ownerId: c.shopId,
    type,
    amount,
    idempotencyKey: randomUUID(),
    actorId: c.cashierId,
  });
}

describe("cashier shifts", () => {
  it("opens one shift per cashier and replays the same key", async () => {
    const c = await counter();
    const key = `open-${randomUUID()}`;
    const first = await open(c, 2_000_000, key);
    const replay = await open(c, 2_000_000, key);
    const second = await open(c, 1_000_000);

    expect(first.status).toBe(201);
    expect(cashierShiftSchema.safeParse(first.body).success).toBe(true);
    expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect(second.status).toBe(409);

    const current = await api("GET", "/api/v1/shop/shifts/current", { actor: cashier(c) });

    expect((current.body as { shift: { id: string } }).shift.id).toBe((first.body as { id: string }).id);
  });

  it("computes expected cash from the ledger and the discrepancy from the count, behind the PIN", async () => {
    const c = await counter();
    const shift = (await open(c, 1_000_000)).body as { id: string };

    await counterEntry(c, "TICKET_SALE", 500_000);
    await counterEntry(c, "TICKET_SALE", 250_000);
    await counterEntry(c, "TICKET_PAYOUT", 300_000);
    await counterEntry(c, "TICKET_CANCEL", 50_000);

    const cashIn = await api("POST", "/api/v1/shop/shifts/current/cash", {
      actor: cashier(c),
      headers: { "idempotency-key": `cash-${randomUUID()}` },
      body: { type: "CASH_IN", amount: 200_000, note: "Float top-up from safe" },
    });
    const cashOut = await api("POST", "/api/v1/shop/shifts/current/cash", {
      actor: cashier(c),
      headers: { "idempotency-key": `cash-${randomUUID()}` },
      body: { type: "CASH_OUT", amount: 100_000, note: "Banked at lunch" },
    });

    expect(cashIn.status).toBe(200);
    expect(cashOut.status).toBe(200);
    expect(running.signals).toContain(`shop:${c.shopId}`);

    const expected = 1_000_000 + 750_000 - 300_000 - 50_000 + 200_000 - 100_000;

    expect((cashOut.body as { totals: { expectedCash: number; ticketsSold: number } }).totals).toMatchObject({
      expectedCash: expected,
      ticketsSold: 2,
      sales: 750_000,
      payouts: 300_000,
      cancellations: 50_000,
      cashIn: 200_000,
      cashOut: 100_000,
    });

    const counted = [
      { denomination: 100_000, count: 14 },
      { denomination: 50_000, count: 1 },
      { denomination: 20_000, count: 1 },
    ];
    const closeKey = `close-${randomUUID()}`;
    const wrongPin = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": closeKey },
      body: { counted, pin: "9999" },
    });

    expect(wrongPin.status).toBe(403);

    running.identity.unreachable = true;

    const unreachable = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": closeKey },
      body: { counted, pin: "2468" },
    });

    running.identity.unreachable = false;

    expect(unreachable.status).toBe(503);

    const closed = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": closeKey },
      body: { counted, pin: "2468", note: "Short by one note" },
    });

    expect(closed.status).toBe(200);
    expect(cashierShiftSchema.safeParse(closed.body).success).toBe(true);
    expect(closed.body).toMatchObject({
      status: "CLOSED",
      countedCash: 1_470_000,
      discrepancy: 1_470_000 - expected,
      discrepancyNote: "Short by one note",
    });

    const replay = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": closeKey },
      body: { counted, pin: "2468" },
    });
    const again = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": `close-${randomUUID()}` },
      body: { counted, pin: "2468" },
    });

    expect(replay.body).toMatchObject({ status: "CLOSED", discrepancy: 1_470_000 - expected });
    expect(again.status).toBe(409);
    expect((await open(c, 500_000)).status).toBe(201);
  });

  it("refuses cash movements without cash:move and a close with unknown denominations", async () => {
    const c = await counter();
    const shift = (await open(c, 0)).body as { id: string };
    const denied = await api("POST", "/api/v1/shop/shifts/current/cash", {
      actor: cashier(c, ["shifts:operate"]),
      headers: { "idempotency-key": `cash-${randomUUID()}` },
      body: { type: "CASH_IN", amount: 1_000, note: "Top up" },
    });
    const odd = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(c),
      headers: { "idempotency-key": `close-${randomUUID()}` },
      body: { counted: [{ denomination: 70_000, count: 1 }], pin: "2468" },
    });

    expect(denied.status).toBe(403);
    expect(odd.status).toBe(422);
  });

  it("does not let a cashier close another cashier's shift", async () => {
    const c = await counter();
    const other = { shopId: c.shopId, cashierId: await fixtures.cashier(c.shopId, "Other Cashier") };
    const shift = (await open(c, 0)).body as { id: string };
    const response = await api("POST", `/api/v1/shop/shifts/${shift.id}/close`, {
      actor: cashier(other),
      headers: { "idempotency-key": `close-${randomUUID()}` },
      body: { counted: [{ denomination: 1_000, count: 0 }], pin: "2468" },
    });

    expect(response.status).toBe(404);
  });

  it("lists own shifts, and every shop shift with reports:read", async () => {
    const c = await counter();
    const other = { shopId: c.shopId, cashierId: await fixtures.cashier(c.shopId, "Other Cashier") };

    await open(c, 0);
    await open(other, 0);

    const own = await api("GET", "/api/v1/shop/shifts", { actor: cashier(c) });
    const all = await api("GET", "/api/v1/shop/shifts", { actor: cashier(c, ["shifts:operate", "reports:read"]) });

    expect((own.body as { items: unknown[] }).items).toHaveLength(1);
    expect((all.body as { items: unknown[] }).items).toHaveLength(2);
  });
});

describe("the sandbox provider", () => {
  it("returns instructions, then settles on the second check, exactly once", async () => {
    const customerId = await fixtures.customer();
    const created = await api("POST", "/api/v1/payments/deposit/initiate", {
      actor: { kind: "CUSTOMER", id: customerId },
      headers: { "idempotency-key": `dep-${randomUUID()}` },
      body: { amount: 250_000, method: "BANK_TRANSFER" },
    });

    expect(depositInitiationSchema.safeParse(created.body).success).toBe(true);
    expect((created.body as { checkoutUrl?: string }).checkoutUrl).toBeUndefined();

    const reference = (created.body as { payment: { reference: string } }).payment.reference;
    const check = async () =>
      (await api("POST", "/api/v1/payments/deposit/verify", { actor: { kind: "CUSTOMER", id: customerId }, body: { reference } })).body as {
        status: string;
      };

    expect((await check()).status).toBe("PROCESSING");
    expect((await check()).status).toBe("CONFIRMED");
    expect((await check()).status).toBe("CONFIRMED");
  });

  it("fails an amount ending in 13 kobo", async () => {
    const customerId = await fixtures.customer();
    const created = await api("POST", "/api/v1/payments/deposit/initiate", {
      actor: { kind: "CUSTOMER", id: customerId },
      headers: { "idempotency-key": `dep-${randomUUID()}` },
      body: { amount: 250_013, method: "CARD" },
    });
    const reference = (created.body as { payment: { reference: string } }).payment.reference;

    await api("POST", "/api/v1/payments/deposit/verify", { actor: { kind: "CUSTOMER", id: customerId }, body: { reference } });

    const failed = await api("POST", "/api/v1/payments/deposit/verify", { actor: { kind: "CUSTOMER", id: customerId }, body: { reference } });

    expect(failed.body).toMatchObject({ status: "FAILED" });
  });

  it("answers bank-account routes as not configured without an encryption key", async () => {
    const customerId = await fixtures.customer();
    const response = await api("POST", "/api/v1/payments/bank-accounts/verify", {
      actor: { kind: "CUSTOMER", id: customerId },
      body: { bankCode: "058", accountNumber: "0123456789" },
    });

    expect(response.status).toBe(503);
    expect(errorCode(response)).toBe("SERVICE_UNAVAILABLE");
  });
});
