import { describe, expect, it, vi } from "vitest";
import type { BetNgRestClient } from "@betng/client-sdk";
import { BetNgApiError } from "@betng/client-sdk";
import type { ShopSession, Ticket } from "@betng/contracts";
import { createPlatformShopSource } from "../src/adapters/platformAccountSources.js";
import { createSessionStore } from "../src/session.js";
import type { SlipSelection } from "../src/types/index.js";

const sessionWith = (balance: number): ShopSession =>
  ({ token: "t".repeat(24), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), shop: { balance }, cashier: {}, permissions: ["tickets:sell"] }) as unknown as ShopSession;

const selection = { matchId: "m", marketId: "k", selectionId: "s", odds: 2 } as unknown as SlipSelection;

function setup(shop: Partial<BetNgRestClient["shop"]>) {
  const store = createSessionStore<ShopSession>("shop");

  store.set(sessionWith(100_000));

  return { store, source: createPlatformShopSource({ shop } as unknown as BetNgRestClient, store) };
}

describe("platform shop source", () => {
  it("sends only ids, odds and stake: labels and prices are the platform's to decide", async () => {
    const placeTicket = vi.fn(async () => ({ code: "BNG-1" }) as Ticket);
    const { source } = setup({ placeTicket, session: async () => sessionWith(100_000) });

    await source.placeTicket({ selections: [{ ...selection, selectionLabel: "Home" }], stake: 20_000 });

    expect(placeTicket).toHaveBeenCalledWith({ selections: [{ matchId: "m", marketId: "k", selectionId: "s", odds: 2 }], stake: 20_000 });
  });

  it("re-reads the float after a sale and tells subscribers", async () => {
    const { source, store } = setup({ placeTicket: async () => ({ code: "BNG-1" }) as Ticket, session: async () => sessionWith(120_000) });
    const listener = vi.fn();

    source.subscribe(listener);
    await source.placeTicket({ selections: [selection], stake: 20_000 });
    await vi.waitFor(() => {
      expect(store.snapshot().session?.shop.balance).toBe(120_000);
    });

    expect(listener).toHaveBeenCalled();
  });

  it("does not fail a sale because the float refresh failed", async () => {
    const { source, store } = setup({
      placeTicket: async () => ({ code: "BNG-2" }) as Ticket,
      session: async () => {
        throw new Error("down");
      },
    });

    await expect(source.placeTicket({ selections: [selection], stake: 20_000 })).resolves.toMatchObject({ code: "BNG-2" });
    expect(store.snapshot().status).toBe("AUTHENTICATED");
  });

  it("ends the session when the platform rejects the token, and reports it as such", async () => {
    const { source, store } = setup({
      listTickets: async () => {
        throw new BetNgApiError(401, { code: "UNAUTHENTICATED", message: "expired", requestId: "r" });
      },
    });

    await expect(source.listTickets()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(store.snapshot().status).toBe("EXPIRED");
  });

  it("reports a paid ticket as a conflict and keeps the session", async () => {
    const { source, store } = setup({
      payoutTicket: async () => {
        throw new BetNgApiError(409, { code: "CONFLICT", message: "Ticket already paid.", requestId: "r" });
      },
    });

    await expect(source.payoutTicket("BNG-1", "1234")).rejects.toMatchObject({ code: "CONFLICT", message: "Ticket already paid." });
    expect(store.snapshot().status).toBe("AUTHENTICATED");
  });
});
