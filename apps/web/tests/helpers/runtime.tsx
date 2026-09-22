import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router";
import type { CustomerSession, FixtureId, LeagueId, MatchId, TeamId } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  DataSourceError,
  createSessionStore,
  type AuthDataSource,
  type BetNgDataSource,
  type FeatureFlags,
  type LeagueView,
  type LiveMatchHandlers,
  type MatchSummary,
  type MatchView,
  type TeamView,
} from "@betng/ui-core";
import { FeatureFlagsProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { __setRuntimeForTests } from "../../src/services/runtime";

export function team(id: string, name: string, leagueId = "league-a"): TeamView {
  return {
    id: id as TeamId,
    leagueId: leagueId as LeagueId,
    name,
    shortName: name,
    code: name.slice(0, 3).toUpperCase(),
    city: `${name} City`,
    stadium: `${name} Ground`,
    colors: { primary: "#224488", secondary: "#ffffff", onPrimary: "#ffffff" },
    strength: 70,
  };
}

export function league(id: string, name: string, overrides: Partial<LeagueView> = {}): LeagueView {
  return {
    id: id as LeagueId,
    name,
    code: id.slice(-1).toUpperCase().padStart(3, "T"),
    slug: id,
    sport: "FOOTBALL",
    status: "ACTIVE",
    country: "Testland",
    teamCount: 10,
    matchdays: 18,
    currentSeason: 3,
    currentMatchday: 7,
    cycleSeconds: 300,
    ...overrides,
  };
}

export function matchSummary(id: string, overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: id as MatchId,
    fixtureId: `fixture-${id}` as FixtureId,
    leagueId: "league-a" as LeagueId,
    leagueName: "Test League A",
    leagueCode: "TLA",
    season: 3,
    matchday: 7,
    home: team(`${id}-home`, `${id} Home`),
    away: team(`${id}-away`, `${id} Away`),
    kickoffAt: "2026-09-21T15:00:00.000Z",
    bettingClosesAt: "2026-09-21T14:59:00.000Z",
    status: "SCHEDULED",
    phase: "SCHEDULED",
    score: { home: 0, away: 0 },
    openMarkets: 0,
    ...overrides,
  };
}

export function matchView(id: string, overrides: Partial<MatchView> = {}): MatchView {
  return { ...matchSummary(id), events: [], ...overrides };
}

function unexpected(name: string) {
  return (): never => {
    throw new DataSourceError("NOT_IMPLEMENTED", `${name} was not expected in this test.`);
  };
}

export interface FakeDataSource extends BetNgDataSource {
  /** Handlers registered through `subscribeMatch`, so a test can push events and signals. */
  readonly matchHandlers: Map<string, LiveMatchHandlers>;
}

/** Reads the shell always makes answer quietly; every other method fails loudly unless the test supplies it. */
export function fakeDataSource(overrides: Partial<BetNgDataSource> = {}): FakeDataSource {
  const matchHandlers = new Map<string, LiveMatchHandlers>();
  const quiet: Partial<BetNgDataSource> = {
    listLeagues: async () => [],
    listMatches: async () => [],
    getConnectionState: () => "CONNECTED",
    subscribeConnection: () => () => undefined,
    subscribeAccount: () => () => undefined,
    recordView: () => undefined,
    subscribeMatch: (matchId, handlers) => {
      matchHandlers.set(matchId, handlers);

      return {
        unsubscribe: () => {
          matchHandlers.delete(matchId);
        },
      };
    },
  };

  return new Proxy({ ...quiet, ...overrides, matchHandlers } as FakeDataSource, {
    get: (target, key) => (key in target ? target[key as keyof FakeDataSource] : unexpected(String(key))),
  });
}

export function fakeAuthSource(session?: CustomerSession): AuthDataSource {
  const store = createSessionStore<CustomerSession>("betng.test.session");

  if (session !== undefined) store.set(session);

  return {
    session: store,
    register: unexpected("register"),
    verify: unexpected("verify"),
    resendVerification: unexpected("resendVerification"),
    login: unexpected("login"),
    logout: async () => {
      store.clear();
    },
    requestPasswordReset: unexpected("requestPasswordReset"),
    completeTwoFactor: unexpected("completeTwoFactor"),
    confirmPasswordReset: unexpected("confirmPasswordReset"),
  };
}

export interface RenderAppOptions {
  readonly dataSource?: BetNgDataSource;
  readonly authSource?: AuthDataSource;
  /** The URL the app starts on. */
  readonly route?: string;
  /** The route pattern `ui` is mounted at, when it reads params (e.g. `/matches/:matchId`). */
  readonly path?: string;
  readonly flags?: Partial<FeatureFlags>;
  /** Replaces the single-route setup, e.g. to exercise an `errorElement`. */
  readonly routes?: RouteObject[];
}

export interface RenderAppResult extends RenderResult {
  readonly router: ReturnType<typeof createMemoryRouter>;
  readonly dataSource: BetNgDataSource;
}

export function renderApp(ui: React.ReactElement, options: RenderAppOptions = {}): RenderAppResult {
  const dataSource = options.dataSource ?? fakeDataSource();

  __setRuntimeForTests({ dataSource, authSource: options.authSource ?? fakeAuthSource() });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const router = createMemoryRouter(options.routes ?? [{ path: options.path ?? "*", element: ui }], {
    initialEntries: [options.route ?? "/"],
  });

  const result = render(
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...options.flags }}>
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>,
  );

  return Object.assign(result, { router, dataSource });
}
