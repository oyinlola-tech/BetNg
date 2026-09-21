import { describe, expect, it, vi } from "vitest";
import { BetNgApiError, type BetNgRestClient } from "@betng/client-sdk";
import type { AdminSession } from "@betng/contracts";
import { createPlatformAdminSource } from "../src/adapters/platformAccountSources.js";
import { createSessionStore } from "../src/session.js";

const notFound = (): never => {
  throw new BetNgApiError(404, { code: "NOT_FOUND", message: "No route", requestId: "r" });
};

function source(admin: Record<string, unknown>) {
  return createPlatformAdminSource({ admin } as unknown as BetNgRestClient, createSessionStore<AdminSession>("t"));
}

describe("platform admin source", () => {
  it("passes a list query through to the platform", async () => {
    const queryList = vi.fn(async () => ({ items: [], page: 2, pageSize: 10, total: 0 }));

    await source({ queryList }).queryList("users", { page: 2, pageSize: 10, search: "ada" });

    expect(queryList).toHaveBeenCalledWith("users", { page: 2, pageSize: 10, search: "ada" });
  });

  it("gathers cashiers per shop while there is no cross-shop route", async () => {
    const cashiers = {
      s1: [{ id: "c1", shopId: "s1", username: "ada", status: "ACTIVE" }, { id: "c2", shopId: "s1", username: "bisi", status: "SUSPENDED" }],
      s2: [{ id: "c3", shopId: "s2", username: "amina", status: "ACTIVE" }],
    };
    const admin = source({
      queryList: vi.fn(async () => notFound()),
      listShops: async () => [{ id: "s1" }, { id: "s2" }],
      listCashiers: async (shopId: "s1" | "s2") => cashiers[shopId],
    });

    expect(await admin.queryList("cashiers", { pageSize: 2 })).toMatchObject({ total: 3, page: 1, pageSize: 2, items: [{ id: "c1" }, { id: "c2" }] });
    expect((await admin.queryList("cashiers", { filters: { status: "ACTIVE" }, search: "AM" })).items).toEqual([cashiers.s2[0]]);
  });

  it("does not hide a real failure behind the fallback", async () => {
    const admin = source({
      queryList: async () => {
        throw new BetNgApiError(403, { code: "FORBIDDEN", message: "no", requestId: "r" });
      },
    });

    await expect(admin.queryList("cashiers")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(source({ queryList: async () => notFound() }).queryList("users")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
