import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from "react-router";
import type { BetId, CustomerSession, MarketId, MatchId, SelectionId, TransactionId, UserId, WalletId } from "@betng/contracts";
import {
  DataSourceError,
  STAKE_LIMITS,
  createSessionStore,
  type AuthDataSource,
  type BetNgDataSource,
  type BetView,
  type MarketView,
  type MatchMarketsView,
  type MatchSummary,
  type SelectionView,
  type SlipSelection,
  type TransactionView,
  type WalletView,
} from "@betng/ui-core";
import { ThemeProvider, ToastProvider } from "@betng/ui-web";
import { AuthDialog } from "../../src/features/auth";
import { useAuthDialog } from "../../src/features/auth/auth.store";
import { useSlipOutcome } from "../../src/features/betslip/outcome.store";
import { accountRoutes, authRoutes } from "../../src/routes/account.routes";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { useBetSlip } from "../../src/stores/betslip.store";

export const TEST_USER = {
  id: "user-1" as UserId,
  email: "ada@example.test",
  displayName: "Ada Obi",
  status: "ACTIVE" as const,
  createdAt: "2026-01-01T10:00:00.000Z",
  lastActiveAt: "2026-09-01T10:00:00.000Z",
};

export function testSession(): CustomerSession {
  return {
    token: "test-token-0123456789abcdef",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: TEST_USER,
  };
}

export function wallet(available: number, overrides: Partial<WalletView> = {}): WalletView {
  return { id: "wallet-1" as WalletId, balance: available, reserved: 0, available, currency: "NGN", simulated: true, ...overrides };
}

export function transaction(index: number, overrides: Partial<TransactionView> = {}): TransactionView {
  return {
    id: `txn-${String(index)}` as TransactionId,
    type: "DEPOSIT",
    amount: 100_000,
    balanceAfter: 100_000 * index,
    description: `Deposit ${String(index)}`,
    createdAt: `2026-09-${String(index).padStart(2, "0")}T09:00:00.000Z`,
    status: "COMPLETED",
    ...overrides,
  };
}

export function market(matchId: string, overrides: Partial<MarketView> = {}): MarketView {
  const id = `${matchId}-result` as MarketId;
  const selection = (code: string, label: string, odds: number): SelectionView => ({
    id: `${id}-${code}` as SelectionId,
    marketId: id,
    code,
    label,
    shortLabel: code,
    odds,
    probability: 0.3,
    trend: "STEADY",
  });

  return {
    id,
    matchId: matchId as MatchId,
    kind: "MATCH_RESULT",
    name: "Match Result",
    status: "OPEN",
    columns: 3,
    selections: [selection("1", "Home", 2), selection("X", "Draw", 3.2), selection("2", "Away", 3.5)],
    ...overrides,
  };
}

export function slipSelection(matchId: string, code: "1" | "X" | "2" = "1", overrides: Partial<SlipSelection> = {}): SlipSelection {
  const source = market(matchId);
  const selection = source.selections.find((s) => s.code === code) ?? source.selections[0];

  if (selection === undefined) throw new Error("fixture market has no selections");

  return {
    selectionId: selection.id,
    marketId: source.id,
    matchId: source.matchId,
    marketKind: source.kind,
    marketName: source.name,
    selectionLabel: selection.label,
    odds: selection.odds,
    matchLabel: `${matchId} home v ${matchId} away`,
    leagueCode: "TST",
    kickoffAt: "2026-09-21T15:00:00.000Z",
    ...overrides,
  };
}

export function matchSummary(matchId: string): MatchSummary {
  return {
    id: matchId as MatchId,
    leagueCode: "TST",
    kickoffAt: "2026-09-21T15:00:00.000Z",
    home: { name: `${matchId} home` },
    away: { name: `${matchId} away` },
  } as unknown as MatchSummary;
}

export function bet(overrides: Partial<BetView> = {}): BetView {
  return {
    id: "bet-1" as BetId,
    legs: [{ ...slipSelection("m1"), outcome: "PENDING" }],
    stake: 20_000,
    totalOdds: 2,
    potentialPayout: 40_000,
    status: "PENDING",
    placedAt: "2026-09-21T12:00:00.000Z",
    ...overrides,
  };
}

function unexpected(name: string) {
  return (): never => {
    throw new DataSourceError("NOT_IMPLEMENTED", `${name} was not expected in this test.`);
  };
}

/** Every method the account screens touch has a quiet default; anything else fails loudly. */
export function fakeDataSource(overrides: Partial<BetNgDataSource> = {}): BetNgDataSource {
  const base: Partial<BetNgDataSource> = {
    getMatchMarkets: async (matchId): Promise<MatchMarketsView> => ({ matchId, markets: [market(matchId)], generatedAt: "2026-09-21T12:00:00.000Z" }),
    subscribeMatch: () => ({ unsubscribe: () => undefined }),
    subscribeConnection: () => () => undefined,
    subscribeAccount: () => () => undefined,
    getConnectionState: () => "CONNECTED",
    getWallet: async () => wallet(1_000_000),
    listTransactions: async () => [],
    queryTransactions: async (query) => ({ items: [], page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: 0 }),
    listBets: async () => [],
    listNotifications: async () => [],
    markNotificationsRead: async () => undefined,
    getNotificationPreferences: async () => ({ matchStarting: true, matchFinished: true, betSettled: true, goals: false }),
    setNotificationPreferences: async () => undefined,
  };

  return new Proxy({ ...base, ...overrides } as BetNgDataSource, {
    get: (target, property) => (property in target ? target[property as keyof BetNgDataSource] : unexpected(String(property))),
  });
}

export function fakeAuthSource(options: { readonly signedIn?: boolean } = {}): AuthDataSource {
  const session = createSessionStore<CustomerSession>("test.session");

  if (options.signedIn === true) session.set(testSession());

  return {
    session,
    register: unexpected("register"),
    verify: unexpected("verify"),
    resendVerification: unexpected("resendVerification"),
    requestPasswordReset: async () => undefined,
    completeTwoFactor: async () => Promise.reject(new Error("completeTwoFactor is not part of this test")),
    confirmPasswordReset: async () => undefined,
    login: async () => {
      const next = testSession();

      session.set(next);

      return next;
    },
    logout: async () => {
      session.clear();
    },
  };
}

export function resetClientState(): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useBetSlip.setState({ selections: [], stake: STAKE_LIMITS.default, open: false, pendingReference: undefined });
  useSlipOutcome.setState({ submitting: false, outcome: undefined });
  useAuthDialog.setState({ open: false, view: "login", intent: undefined, pendingEmail: "" });
}

function Shell(): React.JSX.Element {
  const location = useLocation();

  return (
    <>
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
      <Outlet />
      <AuthDialog />
    </>
  );
}

export interface RenderAccountOptions {
  readonly route?: string;
  readonly dataSource?: BetNgDataSource;
  readonly authSource?: AuthDataSource;
  readonly signedIn?: boolean;
  /** Extra routes beside the account and auth routes, e.g. a page that hosts the slip. */
  readonly routes?: readonly RouteObject[];
}

export interface RenderedAccount extends RenderResult {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
  readonly queryClient: QueryClient;
}

export function renderAccount(options: RenderAccountOptions = {}): RenderedAccount {
  const dataSource = options.dataSource ?? fakeDataSource();
  const authSource = options.authSource ?? fakeAuthSource({ signedIn: options.signedIn ?? true });

  __setRuntimeForTests({ dataSource, authSource });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/", Component: Shell, children: [{ index: true, element: <h1>Home</h1> }, ...(options.routes ?? []), ...accountRoutes, ...authRoutes] }],
    { initialEntries: [options.route ?? "/"] },
  );

  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

  return { ...result, dataSource, authSource, queryClient };
}
