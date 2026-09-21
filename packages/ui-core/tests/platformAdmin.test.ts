import { describe, expect, it, vi } from "vitest";
import { BetNgApiError, type BetNgRestClient } from "@betng/client-sdk";
import type { AdminSession } from "@betng/contracts";
import { createPlatformAdminSource } from "../src/adapters/platformAccountSources.js";
import { createSessionStore } from "../src/session.js";

function source(admin: Record<string, unknown>, serverPaging?: boolean) {
  return createPlatformAdminSource(
    { admin } as unknown as BetNgRestClient,
    createSessionStore<AdminSession>("t"),
    serverPaging === undefined ? {} : { serverPaging },
  );
}

describe("platform admin source", () => {
  it("never sends paging keys the platform refuses: it reads the list route and pages locally", async () => {
    const queryList = vi.fn();
    const listSettlements = vi.fn(async () => [
      { id: "s1", status: "FAILED", payout: 10 },
      { id: "s2", status: "FAILED", payout: 30 },
      { id: "s3", status: "FAILED", payout: 20 },
    ]);
    const page = await source({ queryList, listSettlements }).queryList("settlements", {
      page: 2,
      pageSize: 1,
      sort: "payout",
      direction: "desc",
      filters: { status: "FAILED" },
    });

    expect(queryList).not.toHaveBeenCalled();
    expect(listSettlements).toHaveBeenCalledWith("FAILED");
    expect(page).toEqual({ items: [{ id: "s3", status: "FAILED", payout: 20 }], page: 2, pageSize: 1, total: 3 });
  });

  it("lets the platform search customers, since that route takes a term", async () => {
    const listCustomers = vi.fn(async () => [{ id: "c1", displayName: "Ada Obi" }]);
    const page = await source({ listCustomers }).queryList("users", { search: "zzz-not-local" });

    expect(listCustomers).toHaveBeenCalledWith("zzz-not-local");
    expect(page.total).toBe(1);
  });

  it("gathers cashiers per shop, as there is no cross-shop route", async () => {
    const cashiers = {
      s1: [{ id: "c1", shopId: "s1", username: "ada", status: "ACTIVE" }, { id: "c2", shopId: "s1", username: "bisi", status: "SUSPENDED" }],
      s2: [{ id: "c3", shopId: "s2", username: "amina", status: "ACTIVE" }],
    };
    const admin = source({ listShops: async () => [{ id: "s1" }, { id: "s2" }], listCashiers: async (shopId: "s1" | "s2") => cashiers[shopId] });

    expect(await admin.queryList("cashiers", { pageSize: 2 })).toMatchObject({ total: 3, items: [{ id: "c1" }, { id: "c2" }] });
    expect((await admin.queryList("cashiers", { filters: { status: "ACTIVE" }, search: "AM" })).items).toEqual([cashiers.s2[0]]);
  });

  it("passes the query through once the platform pages lists itself", async () => {
    const queryList = vi.fn(async () => ({ items: [], page: 2, pageSize: 10, total: 0 }));

    await source({ queryList }, true).queryList("users", { page: 2, pageSize: 10, search: "ada" });

    expect(queryList).toHaveBeenCalledWith("users", { page: 2, pageSize: 10, search: "ada" });
  });

  it("reports a real failure as the platform's refusal", async () => {
    const forbidden = async (): Promise<never> => {
      throw new BetNgApiError(403, { code: "FORBIDDEN", message: "no", requestId: "r" });
    };

    await expect(source({ listSimulations: forbidden }).queryList("simulations")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
