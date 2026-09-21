import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminRole,
  AdminSession,
  AdminShopSummary,
  AdminTeam,
  AdminUser,
  AuditLogEntry,
  AuditSeverity,
  CashierCredentials,
  CashierId,
  CommissionConfig,
  PlatformSettings,
  RiskLimits,
  ShopId,
  TeamRatings,
} from "@betng/contracts";
import { DataSourceError, createSessionStore, pageRows, toLocalDateKey, type AdminDataSource, type SessionStorage, type SessionStore } from "@betng/ui-core";
import { COMPETITIONS } from "../clubs.js";
import type { KeyValueStorage, MockPlatform } from "../engine.js";
import { hash, rng, uuidFrom } from "../prng.js";
import { statusAt } from "../season.js";
import { fixtureWindow, ledgerEntries, marketOddsFor, reportDays, riskOverview, serviceHealth, settlementsFor, toAdminFixture, toSimulationRun, tradingMarkets, type MatchOverride, type Overrides } from "./derive.js";
import { accountAnalysis, analyticsBreakdown, analyticsOverview, analyticsSessions, commissionFor, exposureBoard, operatorPeriods, operatorSummary, type Directory } from "./insight.js";
import { ADMINS, ADMIN_PASSWORD, ADMIN_TOTP, DEFAULT_SETTINGS, ratingsFor, seedCashiers, seedCustomers, seedShops } from "./seed.js";

export interface MockAdminOptions {
  readonly platform: MockPlatform;
  readonly storage?: KeyValueStorage & { remove?(key: string): void };
  readonly sessionStorage?: SessionStorage;
  readonly latencyMs?: number;
}

interface TeamPatch {
  name?: string;
  shortName?: string;
  status?: "ACTIVE" | "INACTIVE";
  ratings?: Partial<TeamRatings>;
  updatedAt: string;
}

interface AdminState {
  shops: Record<string, Partial<AdminShopSummary>>;
  createdShops: AdminShopSummary[];
  cashiers: Record<string, "ACTIVE" | "SUSPENDED">;
  createdCashiers: AdminCashierSummary[];
  customers: Record<string, "ACTIVE" | "SUSPENDED">;
  teams: Record<string, TeamPatch>;
  matches: Record<string, MatchOverride>;
  markets: Record<string, "SUSPENDED" | "OPEN">;
  settlements: Record<string, number>;
  settings: PlatformSettings;
  audit: AuditLogEntry[];
  riskLimits?: RiskLimits;
  operatorCloses: string[];
  commissionDefault?: CommissionConfig;
  commissionShops: CommissionConfig[];
}

const SEEDED_AT = new Date(Date.UTC(2026, 7, 1)).toISOString();
const DEFAULT_SHOP_SHARE_PERCENT = 20;
const RISK_LIMIT_FIELDS = ["minStake", "maxStakePerBet", "maxPayoutPerBet", "maxLiabilityPerSelection", "maxLiabilityPerMarket", "maxLiabilityPerMatch"] as const;

const STATE_KEY = "betng.mock.admin.v1";
const SESSION_KEY = "betng.admin.session";
const SESSION_MS = 4 * 3_600_000;
const SECRET = /password|pin|token|secret/i;

const emptyState = (): AdminState => ({ shops: {}, createdShops: [], cashiers: {}, createdCashiers: [], customers: {}, teams: {}, matches: {}, markets: {}, settlements: {}, settings: DEFAULT_SETTINGS, audit: [], operatorCloses: [], commissionShops: [] });

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, SECRET.test(key) ? "[REDACTED]" : redact(inner)]));
}

function seededAudit(now: number): readonly AuditLogEntry[] {
  const actions: readonly (readonly [string, string, AuditSeverity, readonly AdminRole[]])[] = [
    ["admin.login", "session", "INFO", ["SUPER_ADMIN", "OPERATIONS", "RISK_ANALYST", "SUPPORT"]],
    ["shop.update", "shop", "NOTICE", ["SUPER_ADMIN"]],
    ["cashier.reset_credentials", "cashier", "WARNING", ["SUPER_ADMIN"]],
    ["market.suspend", "market", "WARNING", ["SUPER_ADMIN", "RISK_ANALYST"]],
    ["market.resume", "market", "NOTICE", ["SUPER_ADMIN", "RISK_ANALYST"]],
    ["team.update_ratings", "team", "NOTICE", ["SUPER_ADMIN"]],
    ["settlement.retry", "settlement", "WARNING", ["SUPER_ADMIN", "OPERATIONS"]],
    ["user.suspend", "user", "WARNING", ["SUPER_ADMIN"]],
    ["simulation.retry", "simulation", "NOTICE", ["SUPER_ADMIN", "OPERATIONS"]],
    ["settings.update", "settings", "CRITICAL", ["SUPER_ADMIN"]],
    ["ticket.payout", "ticket", "INFO", []],
    ["scheduler.open_betting", "match", "INFO", []],
  ];
  let at = now;

  return Array.from({ length: 140 }, (_, index): AuditLogEntry => {
    const r = rng(`audit:${String(index)}`);
    const [action, resource, severity, roles] = r.pick(actions);
    const system = action.startsWith("scheduler");
    const shop = action.startsWith("ticket");
    const admin = r.pick(ADMINS.filter((a) => roles.length === 0 || roles.includes(a.role)));

    at -= r.int(240, 900) * 1000;
    const resourceId = hash(`audit-resource:${String(index)}`).toString(16).padStart(8, "0");

    return {
      id: uuidFrom(`audit:${String(index)}`),
      timestamp: new Date(at).toISOString(),
      actor: system ? "system" : shop ? `shop:${resourceId}` : `admin:${admin.id}`,
      actorName: system ? "Scheduler" : shop ? "Cashier, BNG-LAG-001" : admin.displayName,
      role: system ? "SYSTEM" : shop ? "CASHIER" : admin.role,
      action,
      resource,
      resourceId,
      severity,
      ...(action === "shop.update" ? { before: { phone: "+234 801 222 1000" }, after: { phone: "+234 801 222 1044" } } : {}),
      ...(action === "market.suspend" ? { before: { status: "OPEN" }, after: { status: "SUSPENDED", reason: "Exposure above market limit" } } : {}),
      ...(action === "cashier.reset_credentials" ? { after: { temporaryPassword: "[REDACTED]", temporaryPin: "[REDACTED]" } } : {}),
      ...(action === "settings.update" ? { before: { maxStake: 25_000_000 }, after: { maxStake: 50_000_000 } } : {}),
      ...(system ? {} : { ip: `102.89.${String(r.int(1, 254))}.${String(r.int(1, 254))}` }),
      requestId: `req_${hash(`audit-req:${String(index)}`).toString(36)}${hash(`audit-req2:${String(index)}`).toString(36)}`,
    };
  });
}

export function createMockAdminSource(options: MockAdminOptions): AdminDataSource {
  const { platform, storage } = options;
  const now = platform.now;
  const latencyMs = options.latencyMs ?? 160;
  const session: SessionStore<AdminSession> = createSessionStore<AdminSession>(SESSION_KEY, options.sessionStorage ?? storage, now);
  const listeners = new Set<() => void>();

  let state = emptyState();

  try {
    const raw = storage?.get(STATE_KEY);

    if (typeof raw === "string" && raw !== "") state = { ...emptyState(), ...(JSON.parse(raw) as Partial<AdminState>) };
  } catch {
    state = emptyState();
  }

  const history = seededAudit(now());
  const baseShops = seedShops(now());
  const baseCustomers = seedCustomers(now());

  const persist = (): void => {
    storage?.set(STATE_KEY, JSON.stringify(state));
    for (const listener of listeners) listener();
  };

  let ticker: ReturnType<typeof setInterval> | undefined;
  const jitter = rng("admin:latency");

  const delay = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs * (0.6 + jitter.next() * 0.8)));

    if (platform.getConnection() === "OFFLINE") throw new DataSourceError("NETWORK", "You appear to be offline.");
  };

  const me = (): AdminUser => {
    const current = session.snapshot();

    if (current.status !== "AUTHENTICATED" || current.session === undefined) {
      throw new DataSourceError(current.status === "EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHENTICATED", "Sign in to continue.");
    }

    // Permissions are re-resolved from the role on every call; what the client stored is never trusted.
    const admin = ADMINS.find((a) => a.id === current.session?.admin.id);

    if (admin === undefined) throw new DataSourceError("SESSION_EXPIRED", "Sign in to continue.");

    return admin;
  };

  const guard = async (permission?: string): Promise<AdminUser> => {
    await delay();

    const admin = me();

    if (permission !== undefined && admin.permissions?.includes(permission) !== true) {
      throw new DataSourceError("FORBIDDEN", `Your role (${admin.role}) does not include “${permission}”.`);
    }

    return admin;
  };

  const record = (admin: AdminUser, action: string, resource: string, resourceId: string, severity: AuditSeverity, before?: unknown, after?: unknown): void => {
    state.audit.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date(now()).toISOString(),
      actor: `admin:${admin.id}`,
      actorName: admin.displayName,
      role: admin.role,
      action,
      resource,
      resourceId,
      severity,
      ...(before === undefined ? {} : { before: redact(before) }),
      ...(after === undefined ? {} : { after: redact(after) }),
      ip: "102.89.34.17",
      requestId: `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    });
    state.audit = state.audit.slice(0, 400);
    persist();
  };

  const overrides = (): Overrides => ({ matches: state.matches, markets: state.markets, settlements: state.settlements });

  const cashiersOf = (shop: AdminShopSummary): readonly AdminCashierSummary[] =>
    [...(state.createdShops.some((s) => s.id === shop.id) ? [] : seedCashiers(shop, now())), ...state.createdCashiers.filter((c) => c.shopId === shop.id)].map((c) => ({ ...c, status: state.cashiers[c.id] ?? c.status }));

  const shops = (): readonly AdminShopSummary[] =>
    [...baseShops, ...state.createdShops].map((shop) => {
      const merged = { ...shop, ...state.shops[shop.id] };

      return { ...merged, cashierCount: cashiersOf(merged).length };
    });

  const requireShop = (shopId: string): AdminShopSummary => {
    const shop = shops().find((s) => s.id === shopId);

    if (shop === undefined) throw new DataSourceError("NOT_FOUND", "That shop does not exist.");

    return shop;
  };

  const customers = (): readonly AdminCustomer[] => baseCustomers.map((c) => ({ ...c, status: state.customers[c.id] ?? c.status }));

  const teams = (leagueId?: string): readonly AdminTeam[] =>
    COMPETITIONS.filter((c) => leagueId === undefined || c.id === leagueId).flatMap((competition) =>
      competition.clubs.map((club): AdminTeam => {
        const patch = state.teams[club.id];

        return {
          id: club.id,
          leagueId: competition.id,
          leagueName: competition.seed.name,
          name: patch?.name ?? club.name,
          shortName: patch?.shortName ?? club.shortName,
          code: club.code,
          status: patch?.status ?? "ACTIVE",
          colors: { primary: club.colors.primary, secondary: club.colors.secondary },
          ratings: { ...ratingsFor(`${competition.seed.key}:${club.code}`, club.strength), ...patch?.ratings },
          updatedAt: patch?.updatedAt ?? new Date(Date.UTC(2026, 7, 1)).toISOString(),
        };
      }),
    );

  const requireFixture = (matchId: string) => {
    const fixture = platform.fixture(matchId);

    if (fixture === undefined) throw new DataSourceError("NOT_FOUND", "That match is not available.");

    return fixture;
  };

  const credentials = (username: string): CashierCredentials => ({
    username,
    temporaryPassword: `Bn-${crypto.randomUUID().slice(0, 8)}`,
    temporaryPin: String(1000 + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 9000)),
    expiresAt: new Date(now() + 24 * 3_600_000).toISOString(),
  });

  const directory = (): Directory => {
    const all = shops();

    return { shops: all, cashiers: all.flatMap(cashiersOf), customers: customers() };
  };

  const riskLimits = (): RiskLimits =>
    state.riskLimits ?? {
      version: 1,
      minStake: state.settings.minStake,
      maxStakePerBet: state.settings.maxStake,
      maxPayoutPerBet: state.settings.maxPayout,
      maxLiabilityPerSelection: Math.round(state.settings.exposureLimit / 60),
      maxLiabilityPerMarket: Math.round(state.settings.exposureLimit / 30),
      maxLiabilityPerMatch: Math.round(state.settings.exposureLimit / 12),
      updatedAt: SEEDED_AT,
    };

  const commissionDefault = (): CommissionConfig => state.commissionDefault ?? { shopSharePercent: DEFAULT_SHOP_SHARE_PERCENT, effectiveFrom: SEEDED_AT };

  const requireReason = (reason: string): string => {
    const trimmed = reason.trim();

    if (trimmed.length < 4 || trimmed.length > 240) throw new DataSourceError("VALIDATION", "Give a reason of 4 to 240 characters.");

    return trimmed;
  };

  const source: AdminDataSource = {
    session,

    /** @endpoint GET /api/v1/admin/<resource>?page=&pageSize=&sort=&direction=&search=&<filter>= → Page<row> */
    queryList: async (resource, query = {}) => {
      const filters = query.filters ?? {};
      const rows = async (): Promise<readonly object[]> => {
        switch (resource) {
          case "users":
            return source.listCustomers();
          case "shops":
            return source.listShops();
          case "cashiers":
            return (await Promise.all((await source.listShops()).map((shop) => source.listCashiers(shop.id)))).flat();
          case "teams":
            return source.listTeams(filters["leagueId"]);
          case "fixtures":
            return source.listFixtures(filters["leagueId"] === undefined ? {} : { leagueId: filters["leagueId"] });
          case "settlements":
            return source.listSettlements();
          case "simulations":
            return source.listSimulations();
        }
      };

      return pageRows(await rows(), query) as never;
    },

    /** @endpoint POST /api/v1/admin/auth/login → AdminSession */
    login: async (request) => {
      await delay();

      const admin = ADMINS.find((a) => a.email === request.email.trim().toLowerCase());

      if (admin === undefined || request.password !== ADMIN_PASSWORD) throw new DataSourceError("INVALID_CREDENTIALS", "That email and password do not match an admin account.");

      if (admin.twoFactorEnabled) {
        if (request.code === undefined) throw new DataSourceError("VALIDATION", "This account uses two-factor authentication. Enter the six-digit code from your authenticator.");
        if (request.code !== ADMIN_TOTP) throw new DataSourceError("VALIDATION", "That code is not correct. Check your authenticator and try again.");
      }

      const next: AdminSession = {
        token: `mock-admin-${crypto.randomUUID()}`,
        expiresAt: new Date(now() + SESSION_MS).toISOString(),
        admin: { ...admin, lastLoginAt: new Date(now()).toISOString() },
      };

      session.set(next);
      record(admin, "admin.login", "session", admin.id, "INFO");

      return next;
    },

    /** @endpoint POST /api/v1/admin/auth/logout → 204 */
    logout: async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      session.clear();
    },

    subscribe: (listener) => {
      listeners.add(listener);

      // The season moves on its own, so screens are nudged every few seconds while anyone is watching.
      ticker ??= setInterval(() => {
        for (const l of listeners) l();
      }, 5000);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0 && ticker !== undefined) {
          clearInterval(ticker);
          ticker = undefined;
        }
      };
    },

    /** @endpoint GET /api/v1/admin/overview → PlatformOverview */
    getOverview: async () => {
      await guard();

      const t = now();
      const today = toLocalDateKey(new Date(t));
      const day = reportDays(today, today, t)[0];
      const live = fixtureWindow(t, 1, 0).filter((f) => statusAt(f, t) === "IN_PLAY" && state.matches[f.matchId]?.voided !== true).length;
      const wave = Math.sin(t / 600_000);

      return {
        activeUsers: Math.round(1840 + wave * 210 + (hash(String(Math.floor(t / 15_000))) % 40)),
        activeShops: shops().filter((s) => s.status === "ACTIVE").length,
        openBets: Math.round(6200 + wave * 800 + (hash(String(Math.floor(t / 10_000))) % 120)),
        liveMatches: live,
        todayStake: day?.stake ?? 0,
        todayPayouts: day?.payouts ?? 0,
        todayNet: day?.net ?? 0,
        generatedAt: new Date(t).toISOString(),
      };
    },

    /** @endpoint GET /api/v1/admin/health/services → { items: ServiceHealth[] } */
    listServiceHealth: async () => {
      await guard("health:read");

      return serviceHealth(now());
    },

    /** @endpoint GET /api/v1/admin/users?q= → { items: AdminCustomer[] } */
    listCustomers: async (q) => {
      await guard("users:read");

      const needle = q?.trim().toLowerCase() ?? "";

      return customers().filter((c) => needle === "" || `${c.displayName} ${c.email} ${c.phone ?? ""}`.toLowerCase().includes(needle));
    },

    /** @endpoint POST /api/v1/admin/users/:id/status → AdminCustomer */
    setCustomerStatus: async (userId, status, reason) => {
      const admin = await guard("users:write");
      const customer = customers().find((c) => c.id === userId);

      if (customer === undefined) throw new DataSourceError("NOT_FOUND", "That user does not exist.");
      if (customer.status === status) throw new DataSourceError("CONFLICT", `That user is already ${status.toLowerCase()}.`);

      state.customers[userId] = status;
      record(admin, status === "SUSPENDED" ? "user.suspend" : "user.activate", "user", userId, "WARNING", { status: customer.status }, { status, reason });

      return { ...customer, status };
    },

    /** @endpoint GET /api/v1/admin/shops → { items: AdminShopSummary[] } */
    listShops: async () => {
      await guard("shops:read");

      return shops();
    },

    /** @endpoint GET /api/v1/admin/shops/:id → AdminShopSummary */
    getShop: async (shopId) => {
      await guard("shops:read");

      return requireShop(shopId);
    },

    /** @endpoint POST /api/v1/admin/shops → AdminShopSummary */
    createShop: async (request) => {
      const admin = await guard("shops:write");

      if (shops().some((s) => s.code.toLowerCase() === request.code.toLowerCase())) throw new DataSourceError("CONFLICT", `Shop code ${request.code} is already in use.`);

      const shop: AdminShopSummary = {
        ...request,
        id: crypto.randomUUID() as ShopId,
        status: "ACTIVE",
        balance: 0,
        createdAt: new Date(now()).toISOString(),
        cashierCount: 0,
        todaySales: 0,
        todayPayouts: 0,
        openTickets: 0,
      };

      state.createdShops.push(shop);
      record(admin, "shop.create", "shop", shop.id, "NOTICE", undefined, request);

      return shop;
    },

    /** @endpoint PATCH /api/v1/admin/shops/:id → AdminShopSummary */
    updateShop: async (shopId, request) => {
      const admin = await guard("shops:write");
      const shop = requireShop(shopId);
      const before = Object.fromEntries(Object.keys(request).map((key) => [key, shop[key as keyof AdminShopSummary]]));

      state.shops[shopId] = { ...state.shops[shopId], ...request };
      record(admin, "shop.update", "shop", shopId, "NOTICE", before, request);

      return requireShop(shopId);
    },

    /** @endpoint POST /api/v1/admin/shops/:id/status → AdminShopSummary */
    setShopStatus: async (shopId, status, reason) => {
      const admin = await guard("shops:write");
      const shop = requireShop(shopId);

      if (shop.status === status) throw new DataSourceError("CONFLICT", `That shop is already ${status.toLowerCase()}.`);

      state.shops[shopId] = { ...state.shops[shopId], status };
      record(admin, status === "SUSPENDED" ? "shop.suspend" : "shop.activate", "shop", shopId, "WARNING", { status: shop.status }, { status, reason });

      return requireShop(shopId);
    },

    /** @endpoint GET /api/v1/admin/shops/:id/cashiers → { items: AdminCashierSummary[] } */
    listCashiers: async (shopId) => {
      await guard("shops:read");

      return cashiersOf(requireShop(shopId));
    },

    /** @endpoint POST /api/v1/admin/shops/:id/cashiers → CashierCredentials */
    createCashier: async (shopId, request) => {
      const admin = await guard("cashiers:write");
      const shop = requireShop(shopId);

      if (cashiersOf(shop).some((c) => c.username === request.username)) throw new DataSourceError("CONFLICT", `Username ${request.username} is already taken in this shop.`);

      const cashier: AdminCashierSummary = { ...request, id: crypto.randomUUID() as CashierId, shopId: shop.id, status: "ACTIVE", createdAt: new Date(now()).toISOString(), todayTransactions: 0, todaySales: 0 };
      const issued = credentials(request.username);

      state.createdCashiers.push(cashier);
      record(admin, "cashier.create", "cashier", cashier.id, "NOTICE", undefined, { ...request, shopCode: shop.code, temporaryPassword: issued.temporaryPassword });

      return issued;
    },

    /** @endpoint POST /api/v1/admin/shops/:id/cashiers/:cashierId/status → AdminCashierSummary */
    setCashierStatus: async (shopId, cashierId, status, reason) => {
      const admin = await guard("cashiers:write");
      const cashier = cashiersOf(requireShop(shopId)).find((c) => c.id === cashierId);

      if (cashier === undefined) throw new DataSourceError("NOT_FOUND", "That cashier does not exist.");
      if (cashier.status === status) throw new DataSourceError("CONFLICT", `That cashier is already ${status.toLowerCase()}.`);

      state.cashiers[cashierId] = status;
      record(admin, status === "SUSPENDED" ? "cashier.suspend" : "cashier.reactivate", "cashier", cashierId, "WARNING", { status: cashier.status }, { status, reason });

      return { ...cashier, status };
    },

    /** @endpoint POST /api/v1/admin/shops/:id/cashiers/:cashierId/reset-credentials → CashierCredentials */
    resetCashierCredentials: async (shopId, cashierId) => {
      const admin = await guard("cashiers:write");
      const cashier = cashiersOf(requireShop(shopId)).find((c) => c.id === cashierId);

      if (cashier === undefined) throw new DataSourceError("NOT_FOUND", "That cashier does not exist.");

      const issued = credentials(cashier.username);

      record(admin, "cashier.reset_credentials", "cashier", cashierId, "WARNING", undefined, { username: cashier.username, temporaryPassword: issued.temporaryPassword, temporaryPin: issued.temporaryPin });

      return issued;
    },

    /** @endpoint GET /api/v1/admin/teams?leagueId= → { items: AdminTeam[] } */
    listTeams: async (leagueId) => {
      await guard("catalogue:read");

      return teams(leagueId);
    },

    /** @endpoint PATCH /api/v1/admin/teams/:id → AdminTeam */
    updateTeam: async (teamId, request) => {
      const admin = await guard("catalogue:write");
      const team = teams().find((t) => t.id === teamId);

      if (team === undefined) throw new DataSourceError("NOT_FOUND", "That team does not exist.");

      const previous = state.teams[teamId];

      state.teams[teamId] = {
        ...previous,
        ...(request.name === undefined ? {} : { name: request.name }),
        ...(request.shortName === undefined ? {} : { shortName: request.shortName }),
        ...(request.status === undefined ? {} : { status: request.status }),
        ratings: { ...previous?.ratings, ...(Object.fromEntries(Object.entries(request.ratings ?? {}).filter(([, v]) => v !== undefined)) as Partial<TeamRatings>) },
        updatedAt: new Date(now()).toISOString(),
      };
      record(admin, request.ratings === undefined ? "team.update" : "team.update_ratings", "team", teamId, "NOTICE", { name: team.name, shortName: team.shortName, status: team.status, ratings: team.ratings }, request);

      const updated = teams().find((t) => t.id === teamId);

      if (updated === undefined) throw new DataSourceError("NOT_FOUND", "That team does not exist.");

      return updated;
    },

    /** @endpoint GET /api/v1/admin/fixtures?leagueId=&matchday=&matchStatus= → { items: AdminFixture[] } */
    listFixtures: async (query = {}) => {
      await guard("fixtures:read");

      const t = now();

      return fixtureWindow(t, 4, 2, query.leagueId)
        .map((f) => toAdminFixture(f, t, overrides()))
        .filter((f) => (query.matchday === undefined || f.matchday === query.matchday) && (query.matchStatus === undefined || f.matchStatus === query.matchStatus));
    },

    /** @endpoint GET /api/v1/admin/matches/:id → AdminFixture */
    getFixture: async (matchId) => {
      await guard("fixtures:read");

      return toAdminFixture(requireFixture(matchId), now(), overrides());
    },

    /** @endpoint POST /api/v1/admin/matches/:id/actions → AdminFixture */
    matchAction: async (matchId, request) => {
      const admin = await guard("fixtures:operate");
      const fixture = requireFixture(matchId);
      const before = toAdminFixture(fixture, now(), overrides());
      const next: MatchOverride = { ...state.matches[matchId] };
      const refuse = (message: string): never => {
        throw new DataSourceError("CONFLICT", message);
      };

      switch (request.action) {
        case "OPEN_BETTING":
          if (before.bettingStatus !== "SUSPENDED") refuse("Betting can only be reopened while it is suspended and before the scheduled close.");
          delete next.betting;
          break;
        case "CLOSE_BETTING":
          if (before.bettingStatus !== "OPEN") refuse("Betting is not open on this match.");
          next.betting = "CLOSED";
          break;
        case "START_SIMULATION":
          if (before.simulationStatus !== "QUEUED" || before.matchStatus === "SCHEDULED") refuse("Only a queued run on a match with betting open can be prepared early.");
          delete next.simulationCancelled;
          break;
        case "RERUN_SIMULATION":
          if (before.simulationStatus !== "FAILED") refuse("Only a failed run can be re-queued. A completed result is final.");
          next.simulationRetried = true;
          break;
        case "VOID_MATCH":
          if (before.matchStatus === "CANCELLED") refuse("This match is already void.");
          if (before.settlementStatus === "COMPLETED") refuse("This match has settled. Void it through a settlement reversal instead.");
          next.voided = true;
          break;
      }

      state.matches[matchId] = next;

      const after = toAdminFixture(fixture, now(), overrides());

      record(
        admin,
        `match.${request.action.toLowerCase()}`,
        "match",
        matchId,
        request.action === "VOID_MATCH" ? "CRITICAL" : "WARNING",
        { bettingStatus: before.bettingStatus, simulationStatus: before.simulationStatus, matchStatus: before.matchStatus },
        { bettingStatus: after.bettingStatus, simulationStatus: after.simulationStatus, matchStatus: after.matchStatus, reason: request.reason },
      );

      return after;
    },

    /** @endpoint GET /api/v1/admin/odds?matchId= → { items: AdminMarketOdds[] } */
    listMarketOdds: async (matchId) => {
      await guard("odds:read");

      return matchId === undefined ? tradingMarkets(now(), overrides()) : marketOddsFor(requireFixture(matchId), now(), overrides());
    },

    /** @endpoint POST /api/v1/admin/markets/:id/actions → AdminMarketOdds */
    marketAction: async (marketId, request) => {
      const admin = await guard("odds:write");
      const market = tradingMarkets(now(), overrides()).find((m) => m.marketId === marketId);

      if (market === undefined) throw new DataSourceError("NOT_FOUND", "That market is no longer trading.");
      if (request.action === "SUSPEND" && market.status !== "OPEN") throw new DataSourceError("CONFLICT", "That market is not open.");
      if (request.action === "RESUME" && state.markets[marketId] !== "SUSPENDED") throw new DataSourceError("CONFLICT", "That market was not suspended by an operator.");

      if (request.action === "SUSPEND") state.markets[marketId] = "SUSPENDED";
      else delete state.markets[marketId];

      const after = tradingMarkets(now(), overrides()).find((m) => m.marketId === marketId) ?? market;

      record(admin, request.action === "SUSPEND" ? "market.suspend" : "market.resume", "market", marketId, "WARNING", { status: market.status }, { status: after.status, reason: request.reason });

      return after;
    },

    /** @endpoint GET /api/v1/admin/risk/overview → RiskOverview */
    getRiskOverview: async () => {
      await guard("risk:read");

      return riskOverview(now(), overrides(), state.settings.exposureLimit);
    },

    /** @endpoint GET /api/v1/admin/risk/exposure → { items: MatchExposure[] } */
    listExposure: async () => {
      await guard("risk:read");

      return exposureBoard(now(), overrides(), riskLimits());
    },

    /** @endpoint GET /api/v1/admin/risk/limits → RiskLimits */
    getRiskLimits: async () => {
      await guard("risk:read");

      return riskLimits();
    },

    /** @endpoint PUT /api/v1/admin/risk/limits → RiskLimits */
    updateRiskLimits: async (request) => {
      const admin = await guard("risk:write");
      const reason = requireReason(request.reason);
      const before = riskLimits();
      const next: RiskLimits = { ...before };

      for (const field of RISK_LIMIT_FIELDS) {
        const value = request[field];

        if (value === undefined) continue;
        if (!Number.isSafeInteger(value) || value < 1) throw new DataSourceError("VALIDATION", "Every limit is a whole amount of at least 1.", { fields: { [field]: "Enter a whole amount of at least 1." } });

        next[field] = value;
      }

      if (next.minStake >= next.maxStakePerBet) throw new DataSourceError("VALIDATION", "Minimum stake must be below the maximum stake per bet.");
      if (next.maxLiabilityPerSelection > next.maxLiabilityPerMarket || next.maxLiabilityPerMarket > next.maxLiabilityPerMatch) {
        throw new DataSourceError("VALIDATION", "Liability limits must widen from selection to market to match.");
      }

      state.riskLimits = { ...next, version: before.version + 1, updatedAt: new Date(now()).toISOString(), updatedBy: admin.displayName };
      record(admin, "risk.update_limits", "risk", "limits", "CRITICAL", Object.fromEntries(RISK_LIMIT_FIELDS.filter((f) => request[f] !== undefined).map((f) => [f, before[f]])), { ...request, reason });

      return state.riskLimits;
    },

    /** @endpoint GET /api/v1/admin/analytics/overview?from=&to= → AnalyticsOverview */
    getAnalyticsOverview: async (window = {}) => {
      await guard("reports:read");

      return analyticsOverview(window, directory(), now());
    },

    /** @endpoint GET /api/v1/admin/analytics/breakdown?by=&from=&to=&leagueId=&matchId=&shopId=&limit= → AnalyticsBreakdown */
    getAnalyticsBreakdown: async (query) => {
      await guard("reports:read");

      return analyticsBreakdown(query, directory(), now());
    },

    /** @endpoint GET /api/v1/admin/analytics/sessions?kind=&from=&to=&leagueId= → { items: SessionAnalysis[] } */
    listAnalyticsSessions: async (query) => {
      await guard("reports:read");

      return analyticsSessions(query, directory(), now());
    },

    /** @endpoint GET /api/v1/admin/analytics/:kind/:id?from=&to= → AccountAnalysis (kind is accounts, shops or cashiers) */
    getAccountAnalysis: async (kind, id) => {
      await guard("reports:read");

      const share = (state.commissionShops.find((c) => c.shopId === id) ?? commissionDefault()).shopSharePercent;
      const analysis = accountAnalysis(kind, id, directory(), share);

      if (analysis === undefined) throw new DataSourceError("NOT_FOUND", "That account does not exist.");

      return analysis;
    },

    /** @endpoint GET /api/v1/admin/operator → { current: OperatorSummary, closed: OperatorSummary[] } */
    getOperatorLedger: async () => {
      await guard("settlement:read");

      const t = now();
      const [current, ...closed] = operatorPeriods(state.operatorCloses, t).map((p) => operatorSummary(p, t));

      if (current === undefined) throw new DataSourceError("SERVER", "No reporting period is open.");

      return { current, closed };
    },

    /** @endpoint GET /api/v1/admin/operator/periods → { items: OperatorPeriod[] } */
    listOperatorPeriods: async () => {
      await guard("settlement:read");

      return operatorPeriods(state.operatorCloses, now());
    },

    /** @endpoint POST /api/v1/admin/operator/periods/close { reason } → OperatorSummary */
    closeOperatorPeriod: async (reason) => {
      const admin = await guard("settlement:operate");
      const why = requireReason(reason);
      const t = now();
      const open = operatorPeriods(state.operatorCloses, t)[0];

      if (open === undefined) throw new DataSourceError("SERVER", "No reporting period is open.");
      if (t - Date.parse(open.startsAt) < 1000) throw new DataSourceError("CONFLICT", "That period has only just opened.");

      state.operatorCloses = [...state.operatorCloses, new Date(t).toISOString()].slice(-200);

      const closed = operatorSummary({ ...open, kind: "CUSTOM", status: "CLOSED", endsAt: new Date(t).toISOString() }, t);

      record(admin, "operator.close_period", "operator_period", open.id, "CRITICAL", { status: "OPEN" }, { status: "CLOSED", operatorResult: closed.operatorResult, reason: why });

      return closed;
    },

    /** @endpoint GET /api/v1/admin/commission?periodId= → { items: CommissionSummary[] } */
    listCommission: async (periodId) => {
      await guard("settlement:read");

      const t = now();

      return operatorPeriods(state.operatorCloses, t)
        .filter((p) => periodId === undefined || p.id === periodId)
        .flatMap((p) => commissionFor(p, shops(), state.commissionShops, commissionDefault(), t));
    },

    /** @endpoint GET /api/v1/admin/commission/config → { default: CommissionConfig, shops: CommissionConfig[] } */
    getCommissionConfig: async () => {
      await guard("settlement:read");

      return { default: commissionDefault(), shops: state.commissionShops };
    },

    /** @endpoint PUT /api/v1/admin/commission/config → CommissionConfig */
    updateCommissionConfig: async (request) => {
      const admin = await guard("settlement:operate");
      const reason = requireReason(request.reason);

      if (!Number.isFinite(request.shopSharePercent) || request.shopSharePercent < 0 || request.shopSharePercent > 100) throw new DataSourceError("VALIDATION", "The shop share is a percentage from 0 to 100.");

      const before = request.shopId === undefined ? commissionDefault() : state.commissionShops.find((c) => c.shopId === request.shopId);
      const next: CommissionConfig = {
        ...(request.shopId === undefined ? {} : { shopId: requireShop(request.shopId).id }),
        shopSharePercent: request.shopSharePercent,
        effectiveFrom: new Date(now()).toISOString(),
        updatedBy: admin.displayName,
      };

      if (request.shopId === undefined) state.commissionDefault = next;
      else state.commissionShops = [...state.commissionShops.filter((c) => c.shopId !== request.shopId), next];

      record(admin, "commission.update_config", "commission", request.shopId ?? "default", "CRITICAL", before === undefined ? undefined : { shopSharePercent: before.shopSharePercent }, { shopSharePercent: next.shopSharePercent, reason });

      return next;
    },

    /** @endpoint GET /api/v1/admin/simulations?status= → { items: AdminSimulationRun[] } */
    listSimulations: async (status) => {
      await guard("simulation:read");

      const t = now();

      return fixtureWindow(t, 2, 2)
        .map((f) => toSimulationRun(f, t, overrides()))
        .filter((run) => status === undefined || run.status === status);
    },

    /** @endpoint POST /api/v1/admin/simulations/:id/actions → AdminSimulationRun */
    simulationAction: async (runId, action, reason) => {
      const admin = await guard("simulation:operate");
      const t = now();
      const fixture = fixtureWindow(t, 2, 2).find((f) => `sim-${f.matchId.slice(0, 8)}` === runId);

      if (fixture === undefined) throw new DataSourceError("NOT_FOUND", "That simulation run does not exist.");

      const before = toSimulationRun(fixture, t, overrides());

      if (action === "RETRY" && before.status !== "FAILED") throw new DataSourceError("CONFLICT", "Only a failed run can be retried.");
      if (action === "CANCEL" && before.status !== "READY") throw new DataSourceError("CONFLICT", "Only a prepared run that has not started can be sent back to the queue.");

      state.matches[fixture.matchId] = { ...state.matches[fixture.matchId], ...(action === "RETRY" ? { simulationRetried: true } : { simulationCancelled: true }) };

      const after = toSimulationRun(fixture, now(), overrides());

      record(admin, `simulation.${action.toLowerCase()}`, "simulation", runId, "NOTICE", { status: before.status }, { status: after.status, reason });

      return after;
    },

    /** @endpoint GET /api/v1/admin/settlements?status= → { items: AdminSettlement[] } */
    listSettlements: async (status) => {
      await guard("settlement:read");

      return settlementsFor(now(), overrides()).filter((s) => status === undefined || s.status === status);
    },

    /** @endpoint POST /api/v1/admin/settlements/:id/retry → AdminSettlement */
    retrySettlement: async (settlementId, reason) => {
      const admin = await guard("settlement:operate");
      const before = settlementsFor(now(), overrides()).find((s) => s.id === settlementId);

      if (before === undefined) throw new DataSourceError("NOT_FOUND", "That settlement does not exist.");
      if (before.status !== "FAILED") throw new DataSourceError("CONFLICT", "Only a failed settlement can be retried.");

      state.settlements[settlementId] = now();

      const after = settlementsFor(now(), overrides()).find((s) => s.id === settlementId) ?? before;

      record(admin, "settlement.retry", "settlement", settlementId, "WARNING", { status: before.status }, { status: after.status, reason });

      return after;
    },

    /** @endpoint GET /api/v1/admin/wallet/overview → PlatformWalletOverview */
    getWalletOverview: async () => {
      await guard("wallet:read");

      const t = now();
      const today = toLocalDateKey(new Date(t));
      const day = reportDays(today, today, t)[0];

      return {
        customerBalances: customers().reduce((acc, c) => acc + c.balance, 0) * 43,
        shopFloats: shops().reduce((acc, s) => acc + s.balance, 0),
        reserved: Math.round((day?.stake ?? 0) * 0.08),
        todayDeposits: Math.round((day?.onlineStake ?? 0) * 0.62),
        todayWithdrawals: Math.round((day?.payouts ?? 0) * 0.31),
        entries: ledgerEntries(t),
      };
    },

    /** @endpoint GET /api/v1/admin/reports/daily?from=&to= → { items: PlatformReportDay[] } */
    listReportDays: async (from, to) => {
      await guard("reports:read");

      return reportDays(from, to, now());
    },

    /** @endpoint GET /api/v1/admin/audit → Page<AuditLogEntry> */
    listAuditLog: async (query = {}) => {
      await guard("audit:read");

      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      const has = (value: string | undefined, needle: string | undefined): boolean => needle === undefined || needle === "" || (value ?? "").toLowerCase().includes(needle.toLowerCase());
      const matched = [...state.audit, ...history].filter(
        (entry) =>
          (has(entry.actorName, query.actor) || has(entry.actor, query.actor)) &&
          has(entry.action, query.action) &&
          (has(entry.resource, query.resource) || has(entry.resourceId, query.resource)) &&
          (query.severity === undefined || entry.severity === query.severity) &&
          (query.from === undefined || entry.timestamp >= query.from) &&
          (query.to === undefined || entry.timestamp <= query.to),
      );

      matched.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return { items: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length, page, pageSize };
    },

    /** @endpoint GET /api/v1/admin/settings → PlatformSettings */
    getSettings: async () => {
      await guard("settings:read");

      return state.settings;
    },

    /** @endpoint PATCH /api/v1/admin/settings → PlatformSettings */
    updateSettings: async (request, reason) => {
      const admin = await guard("settings:write");
      const before = state.settings;
      const next = { ...before, ...request };

      if (next.minStake >= next.maxStake) throw new DataSourceError("VALIDATION", "Minimum stake must be below maximum stake.");

      state.settings = next;
      record(admin, "settings.update", "settings", "platform", "CRITICAL", Object.fromEntries(Object.keys(request).map((k) => [k, before[k as keyof PlatformSettings]])), { ...request, reason });

      return next;
    },
  };

  return source;
}
