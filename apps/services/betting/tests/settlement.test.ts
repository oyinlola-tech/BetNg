import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

async function placeBet(stake = 2000): Promise<{ bet: Bet; headers: Record<string, string> }> {
  const match = await harness.seedMatch();
  const userId = crypto.randomUUID();
  const headers = harness.customer(userId);

  harness.wallet.balances.set(userId, 1_000_000);

  const reply = await harness.call<Bet>("POST", "/bets", {
    headers,
    body: { selections: [match.leg(0)], stake },
  });

  expect(reply.status).toBe(201);

  return { bet: reply.body, headers };
}

function settlement(bet: Bet, outcome: "WON" | "LOST" | "VOID", payout: number): unknown {
  return {
    betId: bet.id,
    outcome,
    payout,
    legs: bet.selections.map((leg) => ({ selectionId: leg.selectionId, outcome, result: "1-0" })),
    settledAt: "2026-09-21T10:00:00.000Z",
  };
}

describe("betting.applySettlement", () => {
  it("settles once, answers a repeat without writing, and refuses a different outcome", async () => {
    const { bet, headers } = await placeBet();

    const first = await harness.rpc<{ betId: string; status: string }>(
      "betting.applySettlement",
      settlement(bet, "WON", bet.potentialPayout),
    );

    expect(first).toMatchObject({ success: true, result: { betId: bet.id, status: "WON" } });

    const read = await harness.call<Bet>("GET", `/bets/${bet.id}`, { headers });

    expect(read.body).toMatchObject({
      status: "WON",
      payout: bet.potentialPayout,
      settledAt: "2026-09-21T10:00:00.000Z",
    });
    expect(read.body.selections[0]).toMatchObject({ outcome: "WON", result: "1-0", odds: 2.15 });

    const repeat = await harness.rpc<{ status: string }>(
      "betting.applySettlement",
      { ...(settlement(bet, "WON", bet.potentialPayout) as object), settledAt: "2026-09-22T00:00:00.000Z" },
    );

    expect(repeat.result?.status).toBe("WON");

    const unchanged = await harness.call<Bet>("GET", `/bets/${bet.id}`, { headers });

    expect(unchanged.body.settledAt).toBe("2026-09-21T10:00:00.000Z");

    const conflicting = await harness.rpc("betting.applySettlement", settlement(bet, "LOST", 0));

    expect(conflicting.success).toBe(false);
    expect(conflicting.error?.code).toBe("CONFLICT");
  });

  it("refuses a payout the accepted bet cannot owe, an unknown leg and an unknown bet", async () => {
    const { bet } = await placeBet();

    const inflated = await harness.rpc("betting.applySettlement", settlement(bet, "WON", bet.potentialPayout + 1));
    const paidLoss = await harness.rpc("betting.applySettlement", settlement(bet, "LOST", 100));
    const stranger = await harness.rpc("betting.applySettlement", {
      ...(settlement(bet, "LOST", 0) as object),
      legs: [{ selectionId: crypto.randomUUID(), outcome: "LOST" }],
    });
    const missing = await harness.rpc("betting.applySettlement", {
      ...(settlement(bet, "LOST", 0) as object),
      betId: crypto.randomUUID(),
    });
    const malformed = await harness.rpc("betting.applySettlement", { betId: "nope" });

    expect(inflated.error?.code).toBe("RPC_VALIDATION_ERROR");
    expect(paidLoss.error?.code).toBe("RPC_VALIDATION_ERROR");
    expect(stranger.error?.code).toBe("RPC_VALIDATION_ERROR");
    expect(missing.error?.code).toBe("NOT_FOUND");
    expect(malformed.error?.code).toBe("RPC_VALIDATION_ERROR");

    const stillPending = await harness.admin.$queryRaw<{ status: string }[]>`
      SELECT status::text AS status FROM betting.bets WHERE id = ${bet.id}::uuid`;

    expect(stillPending[0]?.status).toBe("PENDING");
  });

  it("is not reachable without the internal token", async () => {
    const { bet } = await placeBet();
    const reply = await harness.rpc("betting.applySettlement", settlement(bet, "LOST", 0), false);

    expect(reply.success).not.toBe(true);

    const rows = await harness.admin.$queryRaw<{ status: string }[]>`
      SELECT status::text AS status FROM betting.bets WHERE id = ${bet.id}::uuid`;

    expect(rows[0]?.status).toBe("PENDING");
  });
});

describe("database guards", () => {
  it("rejects a change to the stake, the accepted odds, or a settled bet", async () => {
    const { bet } = await placeBet();

    await expect(
      harness.admin.$executeRaw`UPDATE betting.bets SET stake = 1 WHERE id = ${bet.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      harness.admin.$executeRaw`UPDATE betting.bets SET potential_payout = 999999999 WHERE id = ${bet.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      harness.admin.$executeRaw`UPDATE betting.bet_selections SET odds = 50 WHERE bet_id = ${bet.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      harness.admin.$executeRaw`DELETE FROM betting.bets WHERE id = ${bet.id}::uuid`,
    ).rejects.toThrow();

    await harness.rpc("betting.applySettlement", settlement(bet, "LOST", 0));

    await expect(
      harness.admin.$executeRaw`
        UPDATE betting.bets SET status = 'WON', payout = potential_payout WHERE id = ${bet.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      harness.admin.$executeRaw`
        UPDATE betting.bet_selections SET outcome = 'WON' WHERE bet_id = ${bet.id}::uuid`,
    ).rejects.toThrow();

    const rows = await harness.admin.$queryRaw<{ stake: bigint; status: string }[]>`
      SELECT stake, status::text AS status FROM betting.bets WHERE id = ${bet.id}::uuid`;

    expect(rows[0]).toEqual({ stake: 2000n, status: "LOST" });
  });

  it("rejects a bet that breaks the money checks", async () => {
    const insert = async (stake: number, payout: number): Promise<number> =>
      harness.admin.$executeRaw`
        INSERT INTO betting.bets (id, user_id, channel, stake, currency, total_odds, potential_payout,
          status, idempotency_key, placed_at)
        VALUES (${crypto.randomUUID()}::uuid, ${crypto.randomUUID()}::uuid, 'ONLINE', ${stake}, 'NGN', 2.00,
          ${payout}, 'PENDING', ${crypto.randomUUID()}, now())`;

    await expect(insert(0, 100)).rejects.toThrow();
    await expect(insert(1000, 900)).rejects.toThrow();
  });
});
