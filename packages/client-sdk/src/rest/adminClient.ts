import { API_PREFIX } from "@betng/contracts/runtime";
import type {
  AdminCashierSummary,
  AdminCustomer,
  AdminFixture,
  AdminLoginRequest,
  AdminMarketOdds,
  AdminSession,
  AdminSettlement,
  AdminShopSummary,
  AdminSimulationRun,
  AdminTeam,
  AuditLogEntry,
  AuditLogQuery,
  CashierCredentials,
  CreateCashierRequest,
  CreateShopRequest,
  MarketAdminActionRequest,
  MatchAdminActionRequest,
  Page,
  PlatformOverview,
  PlatformReportDay,
  PlatformSettings,
  PlatformWalletOverview,
  RiskOverview,
  ServiceHealth,
  SimulationAdminAction,
  UpdateTeamRequest,
} from "@betng/contracts";
import { buildQuery, type ListResponse, type Requester } from "./request.js";

export interface AdminFixtureQuery {
  readonly leagueId?: string;
  readonly matchday?: number;
  readonly matchStatus?: string;
}

export interface BetNgAdminClient {
  login(request: AdminLoginRequest): Promise<AdminSession>;
  logout(): Promise<void>;
  session(): Promise<AdminSession>;

  getOverview(): Promise<PlatformOverview>;
  listServiceHealth(): Promise<readonly ServiceHealth[]>;

  listCustomers(q?: string): Promise<readonly AdminCustomer[]>;
  setCustomerStatus(userId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<AdminCustomer>;

  listShops(): Promise<readonly AdminShopSummary[]>;
  getShop(shopId: string): Promise<AdminShopSummary>;
  createShop(request: CreateShopRequest): Promise<AdminShopSummary>;
  updateShop(shopId: string, request: Partial<CreateShopRequest>): Promise<AdminShopSummary>;
  setShopStatus(shopId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<AdminShopSummary>;
  listCashiers(shopId: string): Promise<readonly AdminCashierSummary[]>;
  createCashier(shopId: string, request: CreateCashierRequest): Promise<CashierCredentials>;
  setCashierStatus(shopId: string, cashierId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<AdminCashierSummary>;
  resetCashierCredentials(shopId: string, cashierId: string): Promise<CashierCredentials>;

  listTeams(leagueId?: string): Promise<readonly AdminTeam[]>;
  updateTeam(teamId: string, request: UpdateTeamRequest): Promise<AdminTeam>;

  listFixtures(query?: AdminFixtureQuery): Promise<readonly AdminFixture[]>;
  getFixture(matchId: string): Promise<AdminFixture>;
  matchAction(matchId: string, request: MatchAdminActionRequest): Promise<AdminFixture>;

  listMarketOdds(matchId?: string): Promise<readonly AdminMarketOdds[]>;
  marketAction(marketId: string, request: MarketAdminActionRequest): Promise<AdminMarketOdds>;

  getRiskOverview(): Promise<RiskOverview>;

  listSimulations(status?: string): Promise<readonly AdminSimulationRun[]>;
  simulationAction(runId: string, action: SimulationAdminAction, reason: string): Promise<AdminSimulationRun>;

  listSettlements(status?: string): Promise<readonly AdminSettlement[]>;
  retrySettlement(settlementId: string, reason: string): Promise<AdminSettlement>;

  getWalletOverview(): Promise<PlatformWalletOverview>;
  listReportDays(from: string, to: string): Promise<readonly PlatformReportDay[]>;

  listAuditLog(query?: AuditLogQuery): Promise<Page<AuditLogEntry>>;

  getSettings(): Promise<PlatformSettings>;
  updateSettings(request: Partial<PlatformSettings>, reason: string): Promise<PlatformSettings>;
}

export function createAdminClient(request: Requester): BetNgAdminClient {
  const base = `${API_PREFIX}/admin`;
  const list = async <T>(path: string): Promise<readonly T[]> => (await request<ListResponse<T>>("GET", path)).items;

  return {
    login: async (body) => request<AdminSession>("POST", `${base}/auth/login`, body),
    logout: async () => {
      await request<unknown>("POST", `${base}/auth/logout`);
    },
    session: async () => request<AdminSession>("GET", `${base}/auth/session`),

    getOverview: async () => request<PlatformOverview>("GET", `${base}/overview`),
    listServiceHealth: async () => list<ServiceHealth>(`${base}/health/services`),

    listCustomers: async (q) => list<AdminCustomer>(`${base}/users${buildQuery({ q })}`),
    setCustomerStatus: async (userId, status, reason) => request<AdminCustomer>("POST", `${base}/users/${userId}/status`, { status, reason }),

    listShops: async () => list<AdminShopSummary>(`${base}/shops`),
    getShop: async (shopId) => request<AdminShopSummary>("GET", `${base}/shops/${shopId}`),
    createShop: async (body) => request<AdminShopSummary>("POST", `${base}/shops`, body),
    updateShop: async (shopId, body) => request<AdminShopSummary>("PATCH", `${base}/shops/${shopId}`, body),
    setShopStatus: async (shopId, status, reason) => request<AdminShopSummary>("POST", `${base}/shops/${shopId}/status`, { status, reason }),
    listCashiers: async (shopId) => list<AdminCashierSummary>(`${base}/shops/${shopId}/cashiers`),
    createCashier: async (shopId, body) => request<CashierCredentials>("POST", `${base}/shops/${shopId}/cashiers`, body),
    setCashierStatus: async (shopId, cashierId, status, reason) =>
      request<AdminCashierSummary>("POST", `${base}/shops/${shopId}/cashiers/${cashierId}/status`, { status, reason }),
    resetCashierCredentials: async (shopId, cashierId) => request<CashierCredentials>("POST", `${base}/shops/${shopId}/cashiers/${cashierId}/reset-credentials`),

    listTeams: async (leagueId) => list<AdminTeam>(`${base}/teams${buildQuery({ leagueId })}`),
    updateTeam: async (teamId, body) => request<AdminTeam>("PATCH", `${base}/teams/${teamId}`, body),

    listFixtures: async (query = {}) => list<AdminFixture>(`${base}/fixtures${buildQuery({ ...query })}`),
    getFixture: async (matchId) => request<AdminFixture>("GET", `${base}/matches/${matchId}`),
    matchAction: async (matchId, body) => request<AdminFixture>("POST", `${base}/matches/${matchId}/actions`, body),

    listMarketOdds: async (matchId) => list<AdminMarketOdds>(`${base}/odds${buildQuery({ matchId })}`),
    marketAction: async (marketId, body) => request<AdminMarketOdds>("POST", `${base}/markets/${marketId}/actions`, body),

    getRiskOverview: async () => request<RiskOverview>("GET", `${base}/risk/overview`),

    listSimulations: async (status) => list<AdminSimulationRun>(`${base}/simulations${buildQuery({ status })}`),
    simulationAction: async (runId, action, reason) => request<AdminSimulationRun>("POST", `${base}/simulations/${runId}/actions`, { action, reason }),

    listSettlements: async (status) => list<AdminSettlement>(`${base}/settlements${buildQuery({ status })}`),
    retrySettlement: async (settlementId, reason) => request<AdminSettlement>("POST", `${base}/settlements/${settlementId}/retry`, { reason }),

    getWalletOverview: async () => request<PlatformWalletOverview>("GET", `${base}/wallet/overview`),
    listReportDays: async (from, to) => list<PlatformReportDay>(`${base}/reports/daily${buildQuery({ from, to })}`),

    listAuditLog: async (query = {}) => request<Page<AuditLogEntry>>("GET", `${base}/audit${buildQuery({ ...query })}`),

    getSettings: async () => request<PlatformSettings>("GET", `${base}/settings`),
    updateSettings: async (body, reason) => request<PlatformSettings>("PATCH", `${base}/settings`, { ...body, reason }),
  };
}
