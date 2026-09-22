import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { Link, RouterProvider, createMemoryRouter, type RouteObject } from "react-router";
import type { BetId, CustomerSession, LeagueId, MarketId, MatchId, SelectionId, UserId } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  DataSourceError,
  STAKE_LIMITS,
  createSessionStore,
  type AccountServicesSource,
  type AuthDataSource,
  type BetNgDataSource,
  type BetView,
  type FeatureFlags,
  type MarketView,
  type MatchSummary,
} from "@betng/ui-core";
import { ErrorHelpProvider, FeatureFlagsProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { useSlipOutcome } from "../../src/features/betslip/outcome.store";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { useBetSlip } from "../../src/stores/betslip.store";

function unexpected(name: string) {
  return (): never => {
    throw new DataSourceError("NOT_IMPLEMENTED", `${name} was not expected in this test.`);
  };
}

/** Stands in for the platform adapters; every call a test does not supply fails loudly. */
function strict<T extends object>(name: string, members: Partial<T>): T {
  return new Proxy(members as T, {
    get: (target, key) => (key in target ? target[key as keyof T] : typeof key === "string" ? unexpected(`${name}.${key}`) : undefined),
  });
}

export function fakeData(overrides: Partial<BetNgDataSource> = {}): BetNgDataSource {
  return strict<BetNgDataSource>("dataSource", {
    listLeagues: async () => [],
    listMatches: async () => [],
    listBets: async () => [],
    getWallet: async () => ({ id: "w-1", balance: 1_000_000, reserved: 0, available: 1_000_000, currency: "NGN", simulated: true }) as never,
    listNotifications: async () => [],
    getConnectionState: () => "CONNECTED",
    subscribeConnection: () => () => undefined,
    subscribeAccount: () => () => undefined,
    subscribeMatch: () => ({ unsubscribe: () => undefined }),
    recordView: () => undefined,
    ...overrides,
  });
}

export function fakeAccountServices(overrides: { readonly [K in keyof AccountServicesSource]?: Partial<AccountServicesSource[K]> } = {}): AccountServicesSource {
  return strict<AccountServicesSource>("accountServices", {
    payments: strict("payments", overrides.payments ?? {}),
    kyc: strict("kyc", overrides.kyc ?? {}),
    limits: strict("limits", overrides.limits ?? {}),
    security: strict("security", overrides.security ?? {}),
    devices: strict("devices", overrides.devices ?? {}),
    ...(overrides.profile === undefined ? {} : { profile: strict("profile", overrides.profile) }),
  });
}

export const USER_ID = "3f0c9a52-7a51-4c61-9f0a-5a1c2b7d8e90" as UserId;

export function fakeAuth(signedIn = true): AuthDataSource {
  const session = createSessionStore<CustomerSession>("betng.audit.session");

  if (signedIn) {
    session.set({
      token: "audit-token-0123456789abcdef",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: USER_ID, email: "ada@example.test", displayName: "Ada Obi", status: "ACTIVE", createdAt: "2026-01-01T10:00:00.000Z" } as CustomerSession["user"],
    });
  }

  return strict<AuthDataSource>("auth", { session, logout: async () => session.clear() });
}

export function liveMatch(id: string, overrides: Partial<MatchSummary> = {}): MatchSummary {
  const team = (side: string) =>
    ({
      id: `${id}-${side}`,
      leagueId: "league-a",
      name: `${id} ${side}`,
      shortName: `${id} ${side}`,
      code: side.slice(0, 3).toUpperCase(),
      city: "",
      stadium: "",
      colors: { primary: "#224488", secondary: "#ffffff", onPrimary: "#ffffff" },
      strength: 70,
    }) as MatchSummary["home"];

  return {
    id: id as MatchId,
    fixtureId: `fixture-${id}`,
    leagueId: "league-a" as LeagueId,
    leagueName: "Test League",
    leagueCode: "TST",
    season: 1,
    matchday: 3,
    home: team("home"),
    away: team("away"),
    kickoffAt: "2026-09-22T10:00:00.000Z",
    bettingClosesAt: "2026-09-22T09:59:00.000Z",
    status: "IN_PLAY",
    phase: "LIVE",
    score: { home: 2, away: 1 },
    clock: { period: "SECOND_HALF", minute: 63, asOf: "2026-09-22T10:40:00.000Z" },
    openMarkets: 1,
    ...overrides,
  } as MatchSummary;
}

export function resultMarket(matchId: string, odds: readonly [number, number, number] = [2, 3.2, 3.5], overrides: Partial<MarketView> = {}): MarketView {
  const id = `${matchId}-result` as MarketId;
  const codes = ["1", "X", "2"] as const;
  const labels = ["Home", "Draw", "Away"] as const;

  return {
    id,
    matchId: matchId as MatchId,
    kind: "MATCH_RESULT",
    name: "Match Result",
    status: "OPEN",
    columns: 3,
    selections: codes.map((code, index) => ({
      id: `${id}-${code}` as SelectionId,
      marketId: id,
      code,
      label: labels[index] ?? code,
      shortLabel: code,
      odds: odds[index] ?? 2,
      probability: 0.3,
      trend: "STEADY",
    })),
    ...overrides,
  };
}

export function openBet(id: string, matchId: string, overrides: Partial<BetView> = {}): BetView {
  const market = resultMarket(matchId);
  const selection = market.selections[0];

  if (selection === undefined) throw new Error("fixture market has no selections");

  return {
    id: id as BetId,
    legs: [
      {
        selectionId: selection.id,
        marketId: market.id,
        matchId: market.matchId,
        marketKind: market.kind,
        marketName: market.name,
        selectionLabel: "Home",
        odds: 2,
        matchLabel: `${matchId} home v ${matchId} away`,
        leagueCode: "TST",
        kickoffAt: "2026-09-22T10:00:00.000Z",
        outcome: "PENDING",
      },
    ],
    stake: 20_000,
    totalOdds: 2,
    potentialPayout: 40_000,
    status: "PENDING",
    placedAt: "2026-09-22T09:30:00.000Z",
    reference: `REF-${id}`,
    ...overrides,
  };
}

export interface HarnessOptions {
  readonly route?: string;
  readonly routes: RouteObject[];
  readonly dataSource?: BetNgDataSource;
  readonly authSource?: AuthDataSource;
  readonly accountServices?: AccountServicesSource;
  readonly flags?: Partial<FeatureFlags>;
}

export interface Harness extends RenderResult {
  readonly queryClient: QueryClient;
  readonly router: ReturnType<typeof createMemoryRouter>;
}

export function resetState(): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useBetSlip.setState({ selections: [], stake: STAKE_LIMITS.default, open: false, pendingReference: undefined });
  useSlipOutcome.setState({ submitting: false, outcome: undefined });
}

export function renderHarness(options: HarnessOptions): Harness {
  __setRuntimeForTests({
    dataSource: options.dataSource ?? fakeData(),
    authSource: options.authSource ?? fakeAuth(),
    accountServices: options.accountServices ?? fakeAccountServices(),
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(options.routes, { initialEntries: [options.route ?? "/"] });
  const result = render(
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...options.flags }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ErrorHelpProvider
              value={{
                hrefFor: (topic) => `/help#${topic}`,
                renderLink: ({ href, className, children }) => (
                  <Link to={href} className={className}>
                    {children}
                  </Link>
                ),
              }}
            >
              <RouterProvider router={router} />
            </ErrorHelpProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>,
  );

  return Object.assign(result, { queryClient, router });
}
