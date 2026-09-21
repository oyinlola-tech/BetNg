import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  platformWalletOverviewSchema,
  shopTransactionSchema,
} from "@betng/contracts";
import {
  api,
  createFixtures,
  errorCode,
  startApp,
  WELCOME_GRANT,
} from "./support.js";
import type { ActorInit, Fixtures, RunningApp } from "./support.js";

let fixtures: Fixtures;
let running: RunningApp;

beforeAll(async () => {
  fixtures = await createFixtures();
  running = await startApp();
});

afterAll(async () => {
  await running.stop();
  await fixtures.close();
});

const ADMIN: ActorInit = {
  kind: "ADMIN",
  id: randomUUID(),
  permissions: ["wallet:read"],
};

interface Entry {
  readonly wallet: { readonly userId: string; readonly balance: number };
  readonly transaction: {
    readonly id: string;
    readonly type: string;
    readonly amount: number;
    readonly balanceAfter: number;
  };
}

describe("customer routes", () => {
  it("refuses a request that did not come through the gateway", async () => {
    const customerId = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: customerId } as const;

    const forged = await api("GET", "/api/v1/wallets/me", {
      actor,
      external: true,
    });
    const anonymous = await api("GET", "/api/v1/wallets/me");

    expect(forged.status).toBe(401);
    expect(anonymous.status).toBe(401);
    expect(errorCode(anonymous)).toBe("UNAUTHENTICATED");
  });

  it("lets a customer read only their own wallet and ledger", async () => {
    const mine = await fixtures.customer();
    const theirs = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: mine } as const;

    await api("GET", "/api/v1/wallets/me", {
      actor: { kind: "CUSTOMER", id: theirs },
    });

    const own = await api("GET", `/api/v1/wallets/${mine}`, { actor });
    const other = await api("GET", `/api/v1/wallets/${theirs}`, { actor });
    const otherLedger = await api(
      "GET",
      `/api/v1/wallets/${theirs}/transactions`,
      { actor },
    );

    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
    expect(errorCode(other)).toBe("FORBIDDEN");
    expect(otherLedger.status).toBe(403);
  });

  it("lets an admin read any wallet only with wallet:read", async () => {
    const customerId = await fixtures.customer();

    const allowed = await api("GET", `/api/v1/wallets/${customerId}`, {
      actor: ADMIN,
    });
    const denied = await api("GET", `/api/v1/wallets/${customerId}`, {
      actor: { kind: "ADMIN", id: randomUUID(), permissions: ["bets:read"] },
    });
    const cashier = await api("GET", `/api/v1/wallets/${customerId}`, {
      actor: {
        kind: "CASHIER",
        id: randomUUID(),
        shopId: randomUUID(),
        permissions: ["transactions:read"],
      },
    });

    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({ userId: customerId });
    expect(denied.status).toBe(403);
    expect(cashier.status).toBe(403);
  });

  it("deposits and withdraws on the actor's own wallet, ignoring any userId in the body", async () => {
    const mine = await fixtures.customer();
    const victim = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: mine } as const;

    const deposit = await api("POST", "/api/v1/wallets/deposit", {
      actor,
      body: { userId: victim, amount: 250_000 },
    });
    const withdrawal = await api("POST", "/api/v1/wallets/withdraw", {
      actor,
      body: { userId: victim, amount: 100_000, currency: "NGN" },
    });

    expect(deposit.status).toBe(201);
    expect((deposit.body as Entry).wallet.userId).toBe(mine);
    expect((deposit.body as Entry).transaction).toMatchObject({
      type: "DEPOSIT",
      amount: 250_000,
      balanceAfter: WELCOME_GRANT + 250_000,
    });
    expect(withdrawal.status).toBe(201);
    expect((withdrawal.body as Entry).transaction).toMatchObject({
      type: "WITHDRAWAL",
      amount: -100_000,
      balanceAfter: WELCOME_GRANT + 150_000,
    });

    const untouched = await api("GET", `/api/v1/wallets/${victim}`, {
      actor: ADMIN,
    });

    expect(untouched.body).toMatchObject({ balance: WELCOME_GRANT });

    const ledger = await api("GET", "/api/v1/wallets/me/transactions", {
      actor,
    });
    const items = (ledger.body as { items: { type: string }[] }).items;

    expect(items.map((item) => item.type)).toEqual([
      "WITHDRAWAL",
      "DEPOSIT",
      "WELCOME_GRANT",
    ]);
  });

  it("replays a deposit with the same idempotency-key header without paying twice", async () => {
    const customerId = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: customerId } as const;
    const headers = { "idempotency-key": `retry-${randomUUID()}` };

    const first = await api("POST", "/api/v1/wallets/deposit", {
      actor,
      headers,
      body: { amount: 70_000 },
    });
    const second = await api("POST", "/api/v1/wallets/deposit", {
      actor,
      headers,
      body: { amount: 70_000 },
    });

    expect((second.body as Entry).transaction.id).toBe(
      (first.body as Entry).transaction.id,
    );
    expect((second.body as Entry).wallet.balance).toBe(WELCOME_GRANT + 70_000);
  });

  it("refuses ADMIN and CASHIER on deposit and withdraw", async () => {
    for (const path of ["/api/v1/wallets/deposit", "/api/v1/wallets/withdraw"]) {
      const admin = await api("POST", path, {
        actor: ADMIN,
        body: { amount: 1_000 },
      });
      const cashier = await api("POST", path, {
        actor: { kind: "CASHIER", id: randomUUID(), shopId: randomUUID() },
        body: { amount: 1_000 },
      });

      expect(admin.status).toBe(403);
      expect(cashier.status).toBe(403);
    }
  });

  it("validates the amount: bounds, integers, unknown fields, overdraft", async () => {
    const customerId = await fixtures.customer();
    const actor = { kind: "CUSTOMER", id: customerId } as const;

    const bodies: unknown[] = [
      { amount: 0 },
      { amount: -5 },
      { amount: 10.5 },
      { amount: "1000" },
      { amount: 100_000_001 },
      { amount: 1_000, balance: 5 },
    ];

    for (const body of bodies) {
      const response = await api("POST", "/api/v1/wallets/deposit", {
        actor,
        body,
      });

      expect(response.status).toBe(422);
      expect(errorCode(response)).toBe("VALIDATION_FAILED");
    }

    const overdraft = await api("POST", "/api/v1/wallets/withdraw", {
      actor,
      body: { amount: WELCOME_GRANT + 1 },
    });

    expect(overdraft.status).toBe(422);
    expect(errorCode(overdraft)).toBe("INSUFFICIENT_FUNDS");
  });
});

describe("shop transactions", () => {
  it("shows a cashier their own shop's counter transactions and nobody else's", async () => {
    const shopA = await fixtures.shop();
    const shopB = await fixtures.shop();
    const cashierA = await fixtures.cashier(shopA, "Ada Counter");
    const cashierB = await fixtures.cashier(shopB, "Bola Counter");

    const post = async (
      procedure: "wallet.credit" | "wallet.debit",
      shopId: string,
      cashierId: string,
      type: string,
      amount: number,
      reference: string,
    ) =>
      running.rpc.call(procedure, {
        ownerType: "SHOP",
        ownerId: shopId,
        amount,
        type,
        idempotencyKey: randomUUID(),
        reference,
        actorId: cashierId,
      });

    await post("wallet.credit", shopA, cashierA, "TICKET_SALE", 200_000, "BNG-AAA111");
    await post("wallet.debit", shopA, cashierA, "TICKET_PAYOUT", 450_000, "BNG-AAA111");
    await post("wallet.credit", shopB, cashierB, "TICKET_SALE", 90_000, "BNG-BBB222");

    const actor: ActorInit = {
      kind: "CASHIER",
      id: cashierA,
      shopId: shopA,
      permissions: ["transactions:read"],
    };

    const today = new Date().toISOString().slice(0, 10);
    const response = await api("GET", `/api/v1/shop/transactions?date=${today}`, {
      actor,
    });
    const items = (response.body as { items: Record<string, unknown>[] }).items;

    expect(response.status).toBe(200);
    expect(items).toHaveLength(2);

    for (const item of items) {
      expect(shopTransactionSchema.safeParse(item).success).toBe(true);
      expect(item).toMatchObject({
        shopId: shopA,
        cashierId: cashierA,
        cashierName: "Ada Counter",
        reference: "BNG-AAA111",
      });
    }

    expect(items.map((item) => [item["type"], item["amount"]])).toEqual([
      ["TICKET_PAYOUT", -450_000],
      ["TICKET_SALE", 200_000],
    ]);

    const spoofed = await api(
      "GET",
      `/api/v1/shop/transactions?shopId=${shopB}`,
      { actor },
    );
    const yesterday = await api(
      "GET",
      "/api/v1/shop/transactions?date=2020-01-01",
      { actor },
    );

    expect(spoofed.status).toBe(422);
    expect((yesterday.body as { items: unknown[] }).items).toEqual([]);
  });

  it("requires a cashier holding transactions:read and a shop id", async () => {
    const shopId = await fixtures.shop();
    const path = "/api/v1/shop/transactions";

    const noPermission = await api("GET", path, {
      actor: { kind: "CASHIER", id: randomUUID(), shopId, permissions: [] },
    });
    const noShop = await api("GET", path, {
      actor: {
        kind: "CASHIER",
        id: randomUUID(),
        permissions: ["transactions:read"],
      },
    });
    const admin = await api("GET", path, { actor: ADMIN });
    const badDate = await api("GET", `${path}?date=2026-02-31`, {
      actor: {
        kind: "CASHIER",
        id: randomUUID(),
        shopId,
        permissions: ["transactions:read"],
      },
    });

    expect(noPermission.status).toBe(403);
    expect(noShop.status).toBe(403);
    expect(admin.status).toBe(403);
    expect(badDate.status).toBe(422);
  });
});

describe("admin wallet overview", () => {
  it("is computed from rows and matches the contract", async () => {
    const before = await api("GET", "/api/v1/admin/wallet/overview", {
      actor: ADMIN,
    });
    const customerId = await fixtures.customer();

    await api("POST", "/api/v1/wallets/deposit", {
      actor: { kind: "CUSTOMER", id: customerId },
      body: { amount: 123_456 },
    });

    const after = await api("GET", "/api/v1/admin/wallet/overview?limit=5", {
      actor: ADMIN,
    });

    const parsedBefore = platformWalletOverviewSchema.parse(before.body);
    const parsedAfter = platformWalletOverviewSchema.parse(after.body);

    expect(after.status).toBe(200);
    expect(parsedAfter.customerBalances - parsedBefore.customerBalances).toBe(
      WELCOME_GRANT + 123_456,
    );
    expect(parsedAfter.todayDeposits - parsedBefore.todayDeposits).toBe(123_456);
    expect(parsedAfter.entries.length).toBeLessThanOrEqual(5);
    expect(parsedAfter.entries[0]).toMatchObject({
      channel: "ONLINE",
      type: "DEPOSIT",
      amount: 123_456,
    });
    expect(parsedAfter.entries[0]?.owner).toMatch(/^Customer /);
  });

  it("is for admins holding wallet:read only", async () => {
    const path = "/api/v1/admin/wallet/overview";
    const customerId = await fixtures.customer();

    const customer = await api("GET", path, {
      actor: { kind: "CUSTOMER", id: customerId },
    });
    const weakAdmin = await api("GET", path, {
      actor: { kind: "ADMIN", id: randomUUID(), permissions: [] },
    });
    const tooMany = await api("GET", `${path}?limit=100000`, { actor: ADMIN });

    expect(customer.status).toBe(403);
    expect(weakAdmin.status).toBe(403);
    expect(tooMany.status).toBe(422);
  });
});
