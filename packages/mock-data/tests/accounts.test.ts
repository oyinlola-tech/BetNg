import { afterAll, describe, expect, it } from "vitest";
import { createMockAdminSource } from "../src/admin/index.js";
import { createMockAuthSource } from "../src/auth/index.js";
import { MockPlatform } from "../src/engine.js";
import { createMockShopSource } from "../src/shop/index.js";

const platform = new MockPlatform({ latencyMs: 0 });

afterAll(() => {
  platform.dispose();
});

describe("mock auth", () => {
  it("signs the demo customer in and keeps the session", async () => {
    const auth = createMockAuthSource({ latencyMs: 0 });
    const session = await auth.login({ email: "demo@betng.test", password: "betng-demo" });

    expect(session.user.email).toBe("demo@betng.test");
    expect(auth.session.snapshot().status).toBe("AUTHENTICATED");
  });

  it("rejects a wrong password, then locks out after repeated failures", async () => {
    const auth = createMockAuthSource({ latencyMs: 0 });
    const codes: string[] = [];

    for (let i = 0; i < 6; i += 1) {
      await auth.login({ email: "demo@betng.test", password: "nope" }).catch((error: { code: string }) => codes.push(error.code));
    }

    expect(codes[0]).toBe("INVALID_CREDENTIALS");
    expect(codes.at(-1)).toBe("RATE_LIMITED");
  });

  it("holds a new account until its email is verified", async () => {
    const auth = createMockAuthSource({ latencyMs: 0 });
    const email = "ngozi@example.ng";

    await expect(auth.register({ email, password: "long-enough-1", displayName: "Ngozi" })).resolves.toMatchObject({ verificationRequired: true });
    await expect(auth.login({ email, password: "long-enough-1" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(auth.verify({ email, code: "000000" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(auth.verify({ email, code: "123456" })).resolves.toMatchObject({ user: { email } });
  });

  it("answers a reset request the same way whether or not the address exists", async () => {
    const auth = createMockAuthSource({ latencyMs: 0 });

    await expect(auth.requestPasswordReset("nobody@example.ng")).resolves.toBeUndefined();
    await expect(auth.requestPasswordReset("demo@betng.test")).resolves.toBeUndefined();
  });

  it("surfaces a network failure instead of hanging", async () => {
    const auth = createMockAuthSource({ latencyMs: 0, isOnline: () => false });

    await expect(auth.login({ email: "demo@betng.test", password: "betng-demo" })).rejects.toMatchObject({ code: "NETWORK" });
  });
});

describe("mock shop", () => {
  const login = (username: string) => ({ shopCode: "BNG-LAG-001", username, password: "betng-demo", pin: "1234" });

  it("refuses bad credentials and a suspended cashier", async () => {
    const shop = createMockShopSource({ platform, latencyMs: 0 });

    await expect(shop.login({ ...login("bisi"), password: "wrong" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(shop.login(login("kunle"))).rejects.toBeDefined();
    expect(shop.session.snapshot().status).toBe("ANONYMOUS");
  });

  it("resolves permissions from the role and enforces them", async () => {
    const shop = createMockShopSource({ platform, latencyMs: 0 });
    const session = await shop.login(login("bisi"));

    expect(session.cashier.role).toBe("CASHIER");
    expect(session.permissions).toContain("tickets:sell");
    expect(session.permissions).not.toContain("reports:read");
    await expect(shop.getDailyReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("pays a winning ticket once, with the PIN, and never twice", async () => {
    const shop = createMockShopSource({ platform, latencyMs: 0 });

    await shop.login(login("tunde"));

    const won = (await shop.listTickets({ status: "WON" }))[0];

    if (won === undefined) throw new Error("the seed should include a winning ticket to pay");

    await expect(shop.payoutTicket(won.code, "0000")).rejects.toBeDefined();

    const paid = await shop.payoutTicket(won.code, "1234");

    expect(paid.status).toBe("PAID");
    expect(paid.payout).toBe(won.potentialPayout);
    await expect(shop.payoutTicket(won.code, "1234")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not find a ticket that does not exist", async () => {
    const shop = createMockShopSource({ platform, latencyMs: 0 });

    await shop.login(login("bisi"));
    await expect(shop.getTicket("BNG-NOPE00")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("mock admin", () => {
  it("requires the second factor where the account has one", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await expect(admin.login({ email: "ops@betng.test", password: "betng-admin" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" })).resolves.toMatchObject({ admin: { role: "SUPER_ADMIN" } });
  });

  it("lets support read shops but not operate on them or see risk", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "support@betng.test", password: "betng-admin" });

    const [shop] = await admin.listShops();

    if (shop === undefined) throw new Error("the seed should include shops");

    await expect(admin.setShopStatus(shop.id, "SUSPENDED", "test reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.getRiskOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("writes every mutation to the audit log with actor, reason and redaction-safe payloads", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" });

    const shop = (await admin.listShops()).find((s) => s.status === "ACTIVE");

    if (shop === undefined) throw new Error("the seed should include an active shop");

    await admin.setShopStatus(shop.id, "SUSPENDED", "Float reconciliation overdue");

    const { items } = await admin.listAuditLog({ resource: "shop", pageSize: 5 });
    const entry = items[0];

    expect(entry?.action).toMatch(/suspend/i);
    expect(entry?.resourceId ?? entry?.resource).toContain(shop.id);
    expect(JSON.stringify(entry)).not.toMatch(/betng-admin|password"\s*:\s*"[^•*]/i);
  });

  it("changes risk limits only with the right role, a reason and sane values, and audits it", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "risk@betng.test", password: "betng-admin" });
    await expect(admin.updateRiskLimits({ maxStakePerBet: 1_000_000, reason: "Tighten stakes" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" });

    const before = await admin.getRiskLimits();

    await expect(admin.updateRiskLimits({ maxStakePerBet: 1_000_000, reason: "no" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(admin.updateRiskLimits({ maxStakePerBet: 1, reason: "Below the minimum" })).rejects.toMatchObject({ code: "VALIDATION" });

    const after = await admin.updateRiskLimits({ maxStakePerBet: 1_000_000, reason: "Tighten stakes" });

    expect(after).toMatchObject({ version: before.version + 1, maxStakePerBet: 1_000_000, minStake: before.minStake });
    expect((await admin.listAuditLog({ action: "risk.update_limits" })).items[0]?.resource).toBe("risk");
  });

  it("derives exposure, analytics, operator periods and commission that agree with themselves", async () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    await admin.login({ email: "ops@betng.test", password: "betng-admin", code: "246810" });

    for (const match of await admin.listExposure()) {
      expect(match.totalStake).toBe(match.markets.reduce((acc, m) => acc + m.totalStake, 0));
      expect(match.worstCaseExposure).toBe(match.markets.reduce((acc, m) => acc + m.worstCaseExposure, 0));
    }

    const overview = await admin.getAnalyticsOverview();

    expect(overview.settledBets + overview.pendingBets).toBe(overview.acceptedBets + overview.limitedBets);
    expect(overview.operatorResult).toBe(overview.settledStake - overview.totalPayout);
    expect((await admin.getAnalyticsBreakdown({ by: "league" })).items).toHaveLength(4);
    expect((await admin.listAnalyticsSessions({ kind: "DAY" })).length).toBeGreaterThan(0);

    const [shop] = await admin.listShops();

    if (shop === undefined) throw new Error("the seed should include shops");

    await expect(admin.getAccountAnalysis("shops", shop.id)).resolves.toMatchObject({ subjectKind: "SHOP", subjectId: shop.id });
    await expect(admin.getAccountAnalysis("accounts", shop.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const periodsBefore = await admin.listOperatorPeriods();
    const closed = await admin.closeOperatorPeriod("End of shift reconciliation");
    const periodsAfter = await admin.listOperatorPeriods();

    expect(periodsBefore[0]?.status).toBe("OPEN");
    expect(closed.period).toMatchObject({ id: periodsBefore[0]?.id, status: "CLOSED" });
    expect(closed.operatorResult).toBe(closed.grossStakes - closed.grossPayouts);
    expect(periodsAfter).toHaveLength(periodsBefore.length + 1);
    expect(periodsAfter.filter((p) => p.status === "OPEN")).toHaveLength(1);
    expect(new Set(periodsAfter.map((p) => p.id)).size).toBe(periodsAfter.length);

    const updated = await admin.updateCommissionConfig({ shopId: shop.id, shopSharePercent: 35, reason: "Flagship shop terms" });
    const commission = await admin.listCommission(closed.period.id);

    expect(updated.shopSharePercent).toBe(35);
    expect((await admin.getCommissionConfig()).shops).toContainEqual(updated);
    expect(commission.find((c) => c.shopId === shop.id)?.shopSharePercent).toBe(35);
    for (const row of commission) expect(row.shopShareAmount + row.platformShareAmount).toBe(row.grossOperatorResult);
  });

  it("exposes no operation that could decide a match", () => {
    const admin = createMockAdminSource({ platform, latencyMs: 0 });

    for (const name of Object.keys(admin)) expect(name).not.toMatch(/score|winner|result/i);
  });
});
