import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixtures, BASE_URL, startApp, WELCOME_GRANT } from "./support.js";
import type { Fixtures, RunningApp } from "./support.js";

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

interface PostResult {
  readonly wallet: {
    readonly userId: string;
    readonly ownerType: string;
    readonly balance: number;
  };
  readonly transaction: {
    readonly id: string;
    readonly type: string;
    readonly amount: number;
    readonly balanceAfter: number;
    readonly reference?: string;
  };
  readonly duplicate: boolean;
}

describe("wallet RPC through POST /rpc", () => {
  it("debits and credits a customer wallet and reports the balance", async () => {
    const customerId = await fixtures.customer();
    const betId = randomUUID();

    const debit = await running.rpc.call<unknown, PostResult>("wallet.debit", {
      ownerType: "CUSTOMER",
      ownerId: customerId,
      amount: 300_000,
      type: "BET_STAKE",
      idempotencyKey: `stake:${betId}`,
      reference: betId,
    });

    const credit = await running.rpc.call<unknown, PostResult>("wallet.credit", {
      ownerType: "CUSTOMER",
      ownerId: customerId,
      amount: 750_000,
      type: "BET_PAYOUT",
      idempotencyKey: `payout:${betId}`,
      reference: betId,
      note: "Settled WON",
      actorId: "system",
    });

    const balance = await running.rpc.call<unknown, Pick<PostResult, "wallet">>(
      "wallet.getBalance",
      { ownerType: "CUSTOMER", ownerId: customerId },
    );

    expect(debit).toMatchObject({
      duplicate: false,
      wallet: { userId: customerId, ownerType: "CUSTOMER" },
      transaction: {
        type: "BET_STAKE",
        amount: -300_000,
        balanceAfter: WELCOME_GRANT - 300_000,
        reference: betId,
      },
    });
    expect(credit.transaction.amount).toBe(750_000);
    expect(balance.wallet.balance).toBe(WELCOME_GRANT + 450_000);
  });

  it("returns duplicate: true for a replayed key and leaves the balance alone", async () => {
    const customerId = await fixtures.customer();
    const payload = {
      ownerType: "CUSTOMER",
      ownerId: customerId,
      amount: 125_000,
      type: "BET_STAKE",
      idempotencyKey: `stake:${randomUUID()}`,
    };

    const first = await running.rpc.call<unknown, PostResult>(
      "wallet.debit",
      payload,
    );
    const replay = await running.rpc.call<unknown, PostResult>(
      "wallet.debit",
      payload,
    );

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.transaction.id).toBe(first.transaction.id);
    expect(replay.wallet.balance).toBe(WELCOME_GRANT - 125_000);

    await expect(
      running.rpc.call("wallet.debit", { ...payload, amount: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("answers INSUFFICIENT_FUNDS on overdraft", async () => {
    const customerId = await fixtures.customer();

    await expect(
      running.rpc.call("wallet.debit", {
        ownerType: "CUSTOMER",
        ownerId: customerId,
        amount: WELCOME_GRANT + 1,
        type: "BET_STAKE",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("validates the payload: sign of the type, amounts, owner types, unknown keys, shop entries", async () => {
    const customerId = await fixtures.customer();
    const shopId = await fixtures.shop();
    const base = {
      ownerType: "CUSTOMER",
      ownerId: customerId,
      amount: 1_000,
      idempotencyKey: randomUUID(),
    };

    const bad: [string, Record<string, unknown>][] = [
      ["wallet.debit", { ...base, type: "BET_PAYOUT" }],
      ["wallet.credit", { ...base, type: "BET_STAKE" }],
      ["wallet.credit", { ...base, type: "WELCOME_GRANT" }],
      ["wallet.credit", { ...base, type: "OPENING_FLOAT" }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", amount: -1_000 }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", amount: 0 }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", amount: 10.5 }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", amount: 2 ** 53 }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", amount: "1000" }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", ownerId: "42" }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", ownerType: "OPERATOR" }],
      ["wallet.credit", { ...base, type: "BET_PAYOUT", balance: 1 }],
      ["wallet.credit", { ...base, type: "TICKET_SALE", actorId: randomUUID() }],
      ["wallet.credit", { ...base, ownerType: "SHOP", ownerId: shopId, type: "TICKET_SALE" }],
    ];

    for (const [procedure, payload] of bad) {
      await expect(
        running.rpc.call(procedure, payload),
        JSON.stringify(payload),
      ).rejects.toMatchObject({ code: "RPC_VALIDATION_ERROR" });
    }

    const balance = await running.rpc.call<unknown, Pick<PostResult, "wallet">>(
      "wallet.getBalance",
      { ownerType: "CUSTOMER", ownerId: customerId },
    );

    expect(balance.wallet.balance).toBe(WELCOME_GRANT);
  });

  it("is closed to a caller without the internal token", async () => {
    const response = await fetch(`${BASE_URL}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: randomUUID(),
        procedure: "wallet.credit",
        payload: {},
        metadata: {},
        timestamp: Date.now(),
      }),
    });

    expect(response.status).toBe(404);
  });
});
