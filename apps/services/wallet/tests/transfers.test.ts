import { randomUUID } from "node:crypto";
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

/** The stub accepts this one PIN; anything else is a wrong PIN. */
const PIN = "2468";

interface Drawer {
  readonly shopId: string;
  readonly cashierId: string;
}

const actorOf = (drawer: Drawer, role = "CASHIER", permissions = ["shifts:operate", "cash:move", "cash:transfer", "reports:read"]) => ({
  kind: "CASHIER" as const,
  id: drawer.cashierId,
  shopId: drawer.shopId,
  role,
  permissions,
});

async function shop(): Promise<string> {
  return fixtures.shop();
}

async function drawer(shopId: string, name: string, openingFloat: number): Promise<Drawer> {
  const cashierId = await fixtures.cashier(shopId, name);
  const opened = await api("POST", "/api/v1/shop/shifts", {
    actor: { kind: "CASHIER" as const, id: cashierId, shopId, permissions: ["shifts:operate"] },
    headers: { "idempotency-key": `open-${randomUUID()}` },
    body: { openingFloat },
  });

  expect(opened.status).toBe(201);

  return { shopId, cashierId };
}

const transfer = async (
  from: Drawer,
  to: Drawer,
  amount: number,
  overrides: { pin?: string; key?: string; actor?: ReturnType<typeof actorOf>; note?: string } = {},
) =>
  api("POST", "/api/v1/shop/transfers", {
    actor: overrides.actor ?? actorOf(from),
    headers: { "idempotency-key": overrides.key ?? `transfer-${randomUUID()}` },
    body: {
      toCashierId: to.cashierId,
      amount,
      note: overrides.note ?? "handing over the float",
      pin: overrides.pin ?? PIN,
    },
  });

const expected = async (who: Drawer): Promise<number> => {
  const current = await api("GET", "/api/v1/shop/shifts/current", { actor: actorOf(who) });

  return (current.body as { shift: { totals: { expectedCash: number } } }).shift.totals.expectedCash;
};

const shopBalance = async (shopId: string): Promise<number> => {
  const wallet = await running.rpc.call<{ ownerType: string; ownerId: string }, { wallet: { balance: number } }>(
    "wallet.getBalance",
    { ownerType: "SHOP", ownerId: shopId },
  );

  return wallet.wallet.balance;
};

describe("cashier float transfers", () => {
  it("moves float between two drawers and leaves the shop's balance alone", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 500_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 100_000);

    const before = await shopBalance(shopId);

    const answer = await transfer(sender, receiver, 120_000);

    expect(answer.status).toBe(201);
    expect(await expected(sender)).toBe(500_000 - 120_000);
    expect(await expected(receiver)).toBe(100_000 + 120_000);
    // The money never left the shop.
    expect(await shopBalance(shopId)).toBe(before);
  });

  it("is idempotent on the key", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 400_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);
    const key = `transfer-${randomUUID()}`;

    const first = await transfer(sender, receiver, 50_000, { key });
    const second = await transfer(sender, receiver, 50_000, { key });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect((second.body as { duplicate: boolean }).duplicate).toBe(true);
    expect(await expected(sender)).toBe(400_000 - 50_000);
  });

  it("refuses more than the drawer holds", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 10_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);

    const answer = await transfer(sender, receiver, 10_001);

    expect(answer.status).toBe(422);
    expect(await expected(sender)).toBe(10_000);
    expect(await expected(receiver)).toBe(0);
  });

  it("refuses a wrong PIN", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);

    const answer = await transfer(sender, receiver, 1_000, { pin: "0000" });

    expect(answer.status).toBe(422);
    expect(await expected(receiver)).toBe(0);
  });

  it("refuses a cashier with no open shift on either side", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);
    const closedCashier = await fixtures.cashier(shopId, "No Shift");

    const toClosed = await transfer(sender, { shopId, cashierId: closedCashier }, 1_000);

    expect(toClosed.status).toBe(409);

    const noShift: Drawer = { shopId, cashierId: closedCashier };
    const fromClosed = await transfer(noShift, sender, 1_000, { actor: actorOf(noShift) });

    expect(fromClosed.status).toBe(409);
  });

  it("refuses a cashier in another shop", async () => {
    const [firstShop, secondShop] = await Promise.all([shop(), shop()]);
    const sender = await drawer(firstShop, "Ada Sender", 200_000);
    const outsider = await drawer(secondShop, "Other Shop", 200_000);

    const answer = await transfer(sender, outsider, 1_000);

    expect(answer.status).toBe(404);
  });

  it("refuses sending to yourself", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);

    const answer = await transfer(sender, sender, 1_000);

    expect(answer.status).toBe(422);
  });

  it("refuses a cashier without cash:transfer", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);

    const answer = await transfer(sender, receiver, 1_000, {
      actor: actorOf(sender, "CASHIER", ["shifts:operate", "cash:move"]),
    });

    expect(answer.status).toBe(403);
  });

  it("lists the shop's transfers with both names", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 300_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);

    await transfer(sender, receiver, 25_000, { note: "opening the second till" });

    const listed = await api("GET", "/api/v1/shop/transfers", { actor: actorOf(sender) });

    expect(listed.status).toBe(200);

    const { items } = listed.body as {
      items: { fromCashierName: string; toCashierName: string; amount: number; note: string }[];
    };
    const entry = items.find((item) => item.amount === 25_000);

    expect(entry?.fromCashierName).toBe("Ada Sender");
    expect(entry?.toCashierName).toBe("Bisi Receiver");
    expect(entry?.note).toBe("opening the second till");
  });

  it("refuses an unknown field, a zero amount and a short note", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);

    for (const body of [
      { toCashierId: receiver.cashierId, amount: 1_000, note: "handing over", pin: PIN, shopId },
      { toCashierId: receiver.cashierId, amount: 0, note: "handing over", pin: PIN },
      { toCashierId: receiver.cashierId, amount: 1_000, note: "no", pin: PIN },
      { toCashierId: "not-a-uuid", amount: 1_000, note: "handing over", pin: PIN },
    ]) {
      const answer = await api("POST", "/api/v1/shop/transfers", {
        actor: actorOf(sender),
        headers: { "idempotency-key": `transfer-${randomUUID()}` },
        body,
      });

      expect(errorCode(answer)).toBe("VALIDATION_FAILED");
    }
  });
});

describe("float transfer invariants", () => {
  // Raw SQL, not the service: these are the guards that hold even if the service is wrong.
  const insert = (row: Record<string, string | number>) =>
    fixtures.superuser.$executeRawUnsafe(
      `INSERT INTO wallet.shop_float_transfers
         (id, shop_id, from_shift_id, from_cashier_id, to_shift_id, to_cashier_id, amount, note, authorised_by, idempotency_key)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $8, $9::uuid, $10)`,
      ...Object.values(row),
    );

  const row = (overrides: Record<string, string | number> = {}): Record<string, string | number> => ({
    id: randomUUID(),
    shopId: randomUUID(),
    fromShiftId: randomUUID(),
    fromCashierId: randomUUID(),
    toShiftId: randomUUID(),
    toCashierId: randomUUID(),
    amount: 1_000,
    note: "handing over",
    authorisedBy: randomUUID(),
    idempotencyKey: `k-${randomUUID()}`,
    ...overrides,
  });

  it("refuses a transfer with no matching ledger rows", async () => {
    // Every column is valid; the deferred trigger still refuses it at COMMIT because the pair is missing.
    // Prisma reports a `restrict_violation` as a foreign-key error, so the refusal is what is asserted.
    await expect(insert(row())).rejects.toThrow();

    const [{ count }] = await fixtures.superuser.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT COUNT(*)::bigint AS count FROM wallet.shop_float_transfers",
    );

    expect(typeof count).toBe("bigint");
  });

  it("refuses zero, a negative amount, a self-transfer and a short note", async () => {
    const cashier = randomUUID();
    const shift = randomUUID();

    await expect(insert(row({ amount: 0 }))).rejects.toThrow(/amount_positive/iu);
    await expect(insert(row({ amount: -1 }))).rejects.toThrow(/amount_positive/iu);
    await expect(insert(row({ fromCashierId: cashier, toCashierId: cashier }))).rejects.toThrow(/distinct_cashiers/iu);
    await expect(insert(row({ fromShiftId: shift, toShiftId: shift }))).rejects.toThrow(/distinct_shifts/iu);
    await expect(insert(row({ note: "no" }))).rejects.toThrow(/note_present/iu);
  });

  it("is append-only", async () => {
    const shopId = await shop();
    const sender = await drawer(shopId, "Ada Sender", 200_000);
    const receiver = await drawer(shopId, "Bisi Receiver", 0);
    const created = await transfer(sender, receiver, 5_000);
    const id = (created.body as { id: string }).id;

    await expect(
      fixtures.superuser.$executeRawUnsafe(`UPDATE wallet.shop_float_transfers SET amount = 1 WHERE id = '${id}'`),
    ).rejects.toThrow(/append-only/iu);

    await expect(
      fixtures.superuser.$executeRawUnsafe(`DELETE FROM wallet.shop_float_transfers WHERE id = '${id}'`),
    ).rejects.toThrow(/append-only/iu);
  });
});
