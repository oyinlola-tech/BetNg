import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Bet } from "@betng/contracts";
import { startHarness } from "./harness.js";
import type { Harness } from "./harness.js";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(() => {
  harness.risk.next = { decision: "ACCEPT", reason: "WITHIN_LIMIT", maxStake: 10_000_000 };
  harness.signals.fail = false;
  harness.signals.accepted.length = 0;
});

function fundedCustomer(): string {
  const id = crypto.randomUUID();

  harness.wallet.balances.set(id, 1_000_000);

  return id;
}

describe("BET_ACCEPTED realtime signal", () => {
  it("is sent for the customer once an online bet is accepted, with only the bet id", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    const reply = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 50_000 },
    });

    expect(reply.status).toBe(201);
    expect(harness.signals.accepted.map(({ customerId, betId }) => ({ customerId, betId }))).toEqual([
      { customerId: userId, betId: reply.body.id },
    ]);
  });

  it("is not sent for a refused bet", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.risk.next = { decision: "REJECT", reason: "EXPOSURE_LIMIT", maxStake: 0 };

    const reply = await harness.call("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 50_000 },
    });

    expect(reply.status).toBeGreaterThanOrEqual(400);
    expect(harness.signals.accepted).toEqual([]);
  });

  it("never fails a placement when the publisher throws", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.signals.fail = true;

    const reply = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 50_000 },
    });

    expect(reply.status).toBe(201);
    expect(harness.wallet.balanceOf(userId)).toBe(950_000);
  });
});
