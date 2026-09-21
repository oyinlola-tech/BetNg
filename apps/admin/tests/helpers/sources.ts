import { vi, type Mock } from "vitest";
import type { AdminPermission, AdminSession } from "@betng/contracts";
import { createSessionStore, type AdminDataSource, type BetNgDataSource, type SessionStore } from "@betng/ui-core";

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  "users:read",
  "users:write",
  "shops:read",
  "shops:write",
  "cashiers:write",
  "catalogue:read",
  "catalogue:write",
  "fixtures:read",
  "fixtures:operate",
  "odds:read",
  "odds:write",
  "risk:read",
  "risk:write",
  "simulation:read",
  "simulation:operate",
  "settlement:read",
  "settlement:operate",
  "wallet:read",
  "reports:read",
  "audit:read",
  "health:read",
  "settings:read",
  "settings:write",
];

export const SUPPORT_PERMISSIONS: readonly AdminPermission[] = ["users:read", "shops:read", "audit:read", "health:read"];

const NOW = "2026-09-21T12:00:00.000Z";
const emptyPage = { items: [], page: 1, pageSize: 25, total: 0 };
const period = { id: "SESSION-20260921-0001", kind: "DAY", status: "OPEN", startsAt: NOW };
const summary = { period, grossStakes: 0, grossPayouts: 0, operatorResult: 0, operatorResultRate: 0, settledBets: 0, voidBets: 0, refundedStakes: 0 };

/* What each method answers when a test does not say otherwise: the emptiest value its contract allows. */
const EMPTY: Readonly<Record<string, unknown>> = {
  queryList: emptyPage,
  listAuditLog: emptyPage,
  getOverview: { activeUsers: 0, activeShops: 0, openBets: 0, liveMatches: 0, todayStake: 0, todayPayouts: 0, todayNet: 0, generatedAt: NOW },
  getRiskOverview: { totalStake: 0, potentialPayout: 0, exposure: 0, exposureLimit: 0, state: "NORMAL", decisions: { accepted: 0, limited: 0, rejected: 0 }, byMarket: [], byMatch: [], generatedAt: NOW },
  getRiskLimits: { version: 1, minStake: 10_000, maxStakePerBet: 1_000_000, maxPayoutPerBet: 5_000_000, maxLiabilityPerSelection: 10_000_000, maxLiabilityPerMarket: 20_000_000, maxLiabilityPerMatch: 40_000_000, updatedAt: NOW },
  getAnalyticsOverview: {
    totalMatches: 0,
    totalBets: 0,
    acceptedBets: 0,
    limitedBets: 0,
    rejectedBets: 0,
    pendingBets: 0,
    settledBets: 0,
    winningBets: 0,
    losingBets: 0,
    voidBets: 0,
    cancelledBets: 0,
    totalStake: 0,
    pendingStake: 0,
    settledStake: 0,
    totalPayout: 0,
    operatorResult: 0,
    operatorResultRate: 0,
    customers: 0,
    shops: 0,
    cashiers: 0,
    generatedAt: NOW,
  },
  getAnalyticsBreakdown: { by: "league", items: [] },
  getOperatorLedger: { current: summary, closed: [] },
  getCommissionConfig: { default: { shopSharePercent: 20, effectiveFrom: NOW }, shops: [] },
  getWalletOverview: { customerBalances: 0, shopFloats: 0, reserved: 0, todayDeposits: 0, todayWithdrawals: 0, entries: [] },
  getSettings: { minStake: 10_000, maxStake: 1_000_000, maxPayout: 5_000_000, maxSelections: 10, bettingCloseSeconds: 10, ticketExpiryDays: 30, exposureLimit: 100_000_000, maintenanceMode: false },
};

export type FakeAdminSource = AdminDataSource & { readonly calls: (method: keyof AdminDataSource) => Mock };

export function session(permissions: readonly AdminPermission[], role: AdminSession["admin"]["role"] = "SUPER_ADMIN"): AdminSession {
  return {
    token: "test-token-0123456789",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    admin: { id: "00000000-0000-4000-8000-000000000001" as AdminSession["admin"]["id"], email: "admin@example.test", displayName: "Test Admin", role, twoFactorEnabled: false, permissions },
  };
}

/** Every method exists and resolves an empty value; a test overrides only what it is about. */
export function fakeAdminSource(overrides: Partial<Record<keyof AdminDataSource, unknown>> = {}, store: SessionStore<AdminSession> = createSessionStore<AdminSession>("test.admin.session")): FakeAdminSource {
  const mocks = new Map<string, Mock>();

  const method = (name: string): Mock => {
    let mock = mocks.get(name);

    if (mock === undefined) {
      const override = overrides[name as keyof AdminDataSource];

      mock = typeof override === "function" ? vi.fn(override as (...args: unknown[]) => unknown) : vi.fn(() => Promise.resolve(override ?? EMPTY[name] ?? []));
      mocks.set(name, mock);
    }

    return mock;
  };

  return new Proxy({} as FakeAdminSource, {
    get: (_, property) => {
      if (typeof property !== "string" || property === "then") return undefined;
      if (property === "session") return store;
      if (property === "subscribe") return () => () => undefined;
      if (property === "calls") return (name: string) => method(name);

      return method(property);
    },
  });
}

export function fakeDataSource(overrides: Partial<Record<keyof BetNgDataSource, unknown>> = {}): BetNgDataSource {
  const fixed: Readonly<Record<string, unknown>> = {
    getConnectionState: () => "CONNECTED",
    subscribeConnection: () => () => undefined,
    subscribeMatch: () => ({ unsubscribe: () => undefined }),
    getPlatformConfig: () => Promise.resolve({ currency: { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" }, features: {} }),
    getMatch: () => new Promise(() => undefined),
    ...overrides,
  };

  return new Proxy({} as BetNgDataSource, {
    get: (_, property) => {
      if (typeof property !== "string" || property === "then") return undefined;

      return fixed[property] ?? (() => Promise.resolve([]));
    },
  });
}
