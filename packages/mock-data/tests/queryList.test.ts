import { describe, expect, it } from "vitest";
import { createMockAdminSource } from "../src/admin/index.js";
import { pageRows } from "@betng/ui-core";
import { MockPlatform } from "../src/engine.js";

const platform = new MockPlatform({ latencyMs: 0 });

const rows = [
  { id: "a", name: "Ashford", status: "ACTIVE", stake: 300 },
  { id: "b", name: "Riverside", status: "SUSPENDED", stake: 20 },
  { id: "c", name: "Ashby", status: "ACTIVE", stake: 100 },
];

describe("pageRows", () => {
  it("searches, filters, sorts, then cuts the page", () => {
    expect(pageRows(rows, { search: "ash", sort: "stake", direction: "asc", pageSize: 1, page: 2 })).toEqual({
      items: [rows[0]],
      page: 2,
      pageSize: 1,
      total: 2,
    });
    expect(pageRows(rows, { filters: { status: "SUSPENDED", unknown: "x", empty: "" } }).items).toEqual([rows[1]]);
    expect(pageRows(rows, { sort: "stake", direction: "desc" }).items.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps the platform's order without a sort and clamps the page size", () => {
    expect(pageRows(rows, {}).items).toEqual(rows);
    expect(pageRows(rows, { pageSize: 5_000 }).pageSize).toBe(100);
    expect(pageRows(rows, { sort: "nonexistent" }).items).toEqual(rows);
  });
});

describe("mock admin queryList", () => {
  it("answers a page with the total, and the same rows as the unpaged list", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" });

    const all = await admin.listCustomers();
    const page = await admin.queryList("users", { pageSize: 5 });

    expect(page.total).toBe(all.length);
    expect(page.items).toEqual(all.slice(0, 5));
  });

  it("lists cashiers across every shop", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" });

    const shops = await admin.listShops();
    const perShop = await Promise.all(shops.map((shop) => admin.listCashiers(shop.id)));
    const page = await admin.queryList("cashiers", { pageSize: 100 });

    expect(page.total).toBe(perShop.flat().length);
    expect(new Set(page.items.map((c) => c.shopId)).size).toBeGreaterThan(1);
  });

  it("enforces the same permission as the list it pages", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "support@betng.test", password: "betng-admin" });

    await expect(admin.queryList("simulations")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.queryList("shops")).resolves.toMatchObject({ page: 1 });
  });
});
