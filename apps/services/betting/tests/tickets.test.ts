import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Ticket } from "@betng/contracts";
import { CASHIER_PIN } from "./fakes.js";
import { startHarness } from "./harness.js";
import type { Harness, SeededMatch, SeededShop } from "./harness.js";

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly data?: { readonly ticket?: Ticket };
  };
}

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(() => {
  harness.risk.next = { decision: "ACCEPT", reason: "WITHIN_LIMIT", maxStake: 10_000_000 };
  harness.wallet.down = false;
});

async function openShop(float = 0): Promise<SeededShop> {
  const shop = await harness.seedShop();

  harness.wallet.balances.set(shop.shopId, float);

  return shop;
}

async function sell(shop: SeededShop, match: SeededMatch, stake = 10_000): Promise<Ticket> {
  const reply = await harness.call<Ticket>("POST", "/shop/tickets", {
    headers: harness.cashier(shop),
    body: {
      selections: [match.leg(0)],
      stake,
      customerName: "Chidi Okafor",
      customerPhone: "08031234567",
    },
  });

  expect(reply.status).toBe(201);

  return reply.body;
}

async function betIdOf(ticket: Ticket): Promise<string> {
  const rows = await harness.admin.$queryRaw<{ id: string }[]>`
    SELECT bet_id::text AS id FROM betting.tickets WHERE id = ${ticket.id}::uuid`;

  return rows[0]?.id ?? "";
}

async function settle(ticket: Ticket, outcome: "WON" | "LOST" | "VOID"): Promise<void> {
  const payout = outcome === "WON" ? ticket.potentialPayout : outcome === "VOID" ? ticket.stake : 0;

  const reply = await harness.rpc("betting.applySettlement", {
    betId: await betIdOf(ticket),
    outcome,
    payout,
    legs: ticket.selections.map((leg) => ({
      selectionId: leg.selectionId,
      outcome,
      result: "2-1",
    })),
    settledAt: new Date().toISOString(),
  });

  expect(reply.success).toBe(true);
}

describe("POST /shop/tickets", () => {
  it("sells a ticket: server price, shop and cashier from identity, cash into the float", async () => {
    const shop = await openShop(5000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    expect(ticket.code).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    expect(ticket).toMatchObject({
      shopId: shop.shopId,
      shopCode: shop.shopCode,
      cashierId: shop.cashierId,
      cashierName: "Ada Cashier",
      customerName: "Chidi Okafor",
      status: "OPEN",
      stake: 10_000,
      totalOdds: 2.15,
      potentialPayout: 21_500,
    });

    const kickoff = new Date(ticket.selections[0]?.kickoffAt ?? 0).getTime();

    expect(new Date(ticket.expiresAt).getTime()).toBe(kickoff + 90 * 24 * 60 * 60 * 1000);
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(15_000);

    const sale = harness.wallet.calls.find((call) => call.reference === ticket.code);

    expect(sale).toMatchObject({
      direction: "credit",
      ownerType: "SHOP",
      type: "TICKET_SALE",
      actorId: shop.cashierId,
    });
    expect(sale?.idempotencyKey).toBe(`ticket-sale:${await betIdOf(ticket)}`);
    expect(harness.identity.audits.some((entry) => entry.action === "ticket_sold" && entry.entityId === ticket.id)).toBe(true);

    const stored = await harness.admin.$queryRaw<{ channel: string; user_id: string | null }[]>`
      SELECT channel::text AS channel, user_id::text AS user_id FROM betting.bets
      WHERE id = ${await betIdOf(ticket)}::uuid`;

    expect(stored[0]).toEqual({ channel: "SHOP", user_id: null });
  });

  it("needs tickets:sell, and a cashier who belongs to the shop they claim", async () => {
    const shop = await openShop();
    const other = await openShop();
    const match = await harness.seedMatch();
    const body = { selections: [match.leg(0)], stake: 1000 };

    const noPermission = await harness.call<ErrorBody>("POST", "/shop/tickets", {
      headers: harness.cashier(shop, ["tickets:check"]),
      body,
    });
    const wrongShop = await harness.call<ErrorBody>("POST", "/shop/tickets", {
      headers: harness.cashier({ ...shop, shopId: other.shopId }),
      body,
    });

    expect(noPermission.status).toBe(403);
    expect(wrongShop.status).toBe(403);
    expect(harness.wallet.balanceOf(other.shopId)).toBe(0);
  });
});

describe("GET /shop/tickets", () => {
  it("lists only the caller's shop and searches code, name and phone", async () => {
    const shop = await openShop();
    const rival = await openShop();
    const match = await harness.seedMatch();
    const mine = await sell(shop, match);
    const theirs = await sell(rival, match);
    const headers = harness.cashier(shop);

    const all = await harness.call<{ items: Ticket[] }>("GET", "/shop/tickets", { headers });

    expect(all.body.items.map((ticket) => ticket.id)).toEqual([mine.id]);

    for (const q of [mine.code.slice(2, 8).toLowerCase(), "chidi", "0803123"]) {
      const found = await harness.call<{ items: Ticket[] }>("GET", `/shop/tickets?q=${q}`, { headers });

      expect(found.body.items.map((ticket) => ticket.id)).toEqual([mine.id]);
    }

    const byRivalCode = await harness.call<{ items: Ticket[] }>("GET", `/shop/tickets?q=${theirs.code}`, { headers });
    const today = new Date().toISOString().slice(0, 10);
    const byDate = await harness.call<{ items: Ticket[] }>("GET", `/shop/tickets?status=OPEN&date=${today}`, { headers });
    const wildcard = await harness.call<ErrorBody>("GET", "/shop/tickets?q=%25", { headers });

    expect(byRivalCode.body.items).toEqual([]);
    expect(byDate.body.items).toHaveLength(1);
    expect(wildcard.status).toBe(422);
  });

  it("answers 404 for another shop's ticket", async () => {
    const shop = await openShop();
    const rival = await openShop();
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    const own = await harness.call<Ticket>("GET", `/shop/tickets/${ticket.code}`, { headers: harness.cashier(shop) });
    const foreign = await harness.call<ErrorBody>("GET", `/shop/tickets/${ticket.code}`, { headers: harness.cashier(rival) });
    const payout = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers: harness.cashier(rival),
      body: { pin: CASHIER_PIN },
    });

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(404);
    expect(payout.status).toBe(404);
  });
});

describe("POST /shop/tickets/:code/payout", () => {
  it("pays a won ticket once", async () => {
    const shop = await openShop(100_000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    await settle(ticket, "WON");

    const headers = harness.cashier(shop);
    const paid = await harness.call<Ticket>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers,
      body: { pin: CASHIER_PIN },
    });

    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("PAID");
    expect(paid.body.payout).toBe(21_500);
    expect(paid.body.paidAt).toBeDefined();
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(100_000 + 10_000 - 21_500);
    expect(harness.wallet.ledger.get(`${shop.shopId}:ticket-payout:${ticket.id}`)).toMatchObject({
      type: "TICKET_PAYOUT",
      amount: 21_500,
    });

    const again = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers,
      body: { pin: CASHIER_PIN },
    });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("CONFLICT");
    expect(again.body.error.data?.ticket).toMatchObject({ id: ticket.id, status: "PAID" });
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(88_500);

    const stored = await harness.admin.$queryRaw<{ paid_by: string | null }[]>`
      SELECT paid_by::text AS paid_by FROM betting.tickets WHERE id = ${ticket.id}::uuid`;

    expect(stored[0]?.paid_by).toBe(shop.cashierId);
    expect(harness.identity.audits.filter((entry) => entry.action === "ticket_paid" && entry.entityId === ticket.id)).toHaveLength(1);
  });

  it("pays once when two payouts race", async () => {
    const shop = await openShop(100_000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    await settle(ticket, "WON");

    const attempts = await Promise.all(
      Array.from({ length: 4 }, async () =>
        harness.call<Ticket | ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
          headers: harness.cashier(shop),
          body: { pin: CASHIER_PIN },
        }),
      ),
    );

    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([200, 409, 409, 409]);
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(88_500);
  });

  it("refuses a wrong PIN and moves nothing", async () => {
    const shop = await openShop(100_000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    await settle(ticket, "WON");

    const reply = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers: harness.cashier(shop),
      body: { pin: "0000" },
    });

    expect(reply.status).toBe(403);
    expect(reply.body.error.code).toBe("FORBIDDEN");
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(110_000);

    const read = await harness.call<Ticket>("GET", `/shop/tickets/${ticket.code}`, { headers: harness.cashier(shop) });

    expect(read.body.status).toBe("WON");
  });

  it("refuses a lost ticket and an open one", async () => {
    const shop = await openShop(100_000);
    const match = await harness.seedMatch();
    const lost = await sell(shop, match);
    const open = await sell(shop, match);

    await settle(lost, "LOST");

    for (const ticket of [lost, open]) {
      const reply = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
        headers: harness.cashier(shop),
        body: { pin: CASHIER_PIN },
      });

      expect(reply.status).toBe(409);
      expect(reply.body.error.code).toBe("CONFLICT");
    }

    expect(harness.wallet.balanceOf(shop.shopId)).toBe(120_000);
  });

  it("refunds the stake on a void ticket", async () => {
    const shop = await openShop(0);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match, 4000);

    await settle(ticket, "VOID");

    const reply = await harness.call<Ticket>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers: harness.cashier(shop),
      body: { pin: CASHIER_PIN },
    });

    expect(reply.status).toBe(200);
    expect(reply.body.status).toBe("PAID");
    expect(harness.wallet.ledger.get(`${shop.shopId}:ticket-payout:${ticket.id}`)?.amount).toBe(4000);
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(0);
  });

  it("leaves the ticket payable when the float cannot cover it", async () => {
    const shop = await openShop(0);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    await settle(ticket, "WON");

    const headers = harness.cashier(shop);
    const short = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers,
      body: { pin: CASHIER_PIN },
    });

    expect(short.status).toBe(422);
    expect(short.body.error.code).toBe("INSUFFICIENT_FUNDS");

    harness.wallet.balances.set(shop.shopId, 50_000);

    const paid = await harness.call<Ticket>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers,
      body: { pin: CASHIER_PIN },
    });

    expect(paid.status).toBe(200);
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(28_500);
  });

  it("needs tickets:payout", async () => {
    const shop = await openShop();
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    const reply = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/payout`, {
      headers: harness.cashier(shop, ["tickets:sell", "tickets:check"]),
      body: { pin: CASHIER_PIN },
    });

    expect(reply.status).toBe(403);
  });
});

describe("POST /shop/tickets/:code/cancel", () => {
  it("cancels an open ticket while betting is open and hands the stake back", async () => {
    const shop = await openShop(1000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match, 6000);
    const headers = harness.cashier(shop);

    const reply = await harness.call<Ticket>("POST", `/shop/tickets/${ticket.code}/cancel`, {
      headers,
      body: { reason: "Customer changed their mind" },
    });

    expect(reply.status).toBe(200);
    expect(reply.body.status).toBe("CANCELLED");
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(1000);
    expect(harness.wallet.ledger.get(`${shop.shopId}:ticket-cancel:${ticket.id}`)).toMatchObject({
      type: "TICKET_CANCEL",
      direction: "debit",
      amount: 6000,
    });

    const stored = await harness.admin.$queryRaw<{ status: string; reason: string | null; cancelled: Date | null }[]>`
      SELECT b.status::text AS status, t.cancel_reason AS reason, b.cancelled_at AS cancelled
      FROM betting.tickets t JOIN betting.bets b ON b.id = t.bet_id WHERE t.id = ${ticket.id}::uuid`;

    expect(stored[0]?.status).toBe("CANCELLED");
    expect(stored[0]?.reason).toBe("Customer changed their mind");
    expect(stored[0]?.cancelled).not.toBeNull();

    const again = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/cancel`, {
      headers,
      body: { reason: "Second attempt" },
    });

    expect(again.status).toBe(409);
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(1000);

    const settled = await harness.rpc<{ status: string }>("betting.applySettlement", {
      betId: await betIdOf(ticket),
      outcome: "WON",
      payout: ticket.potentialPayout,
      legs: [],
      settledAt: new Date().toISOString(),
    });

    expect(settled.result?.status).toBe("CANCELLED");
  });

  it("refuses once betting has closed on a leg", async () => {
    const shop = await openShop(1000);
    const match = await harness.seedMatch();
    const ticket = await sell(shop, match);

    await harness.admin.$executeRaw`
      UPDATE match.matches SET lifecycle = 'BETTING_CLOSED' WHERE id = ${match.matchId}::uuid`;

    const reply = await harness.call<ErrorBody>("POST", `/shop/tickets/${ticket.code}/cancel`, {
      headers: harness.cashier(shop),
      body: { reason: "Too late to cancel" },
    });

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("MARKET_CLOSED");
    expect(harness.wallet.balanceOf(shop.shopId)).toBe(11_000);
  });
});
