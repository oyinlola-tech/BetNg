import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from "react-router";
import type { CustomerSession, PaymentRecord, UserId, WalletId } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  DataSourceError,
  type AccountServicesSource,
  type BetNgDataSource,
  type DevicesSource,
  type FeatureFlags,
  type KycSource,
  type LimitsSource,
  type PaymentsSource,
  type ProfileSource,
  type SecuritySource,
  type WalletView,
} from "@betng/ui-core";
import { FeatureFlagsProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { moneyRoutes } from "../../src/routes/money.routes";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { fakeAuthSource, fakeDataSource as quietDataSource } from "../helpers/runtime";

function session(): CustomerSession {
  return {
    token: "test-token-0123456789abcdef",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: "user-1" as UserId, email: "ada@example.test", displayName: "Ada Obi", status: "ACTIVE", createdAt: "2026-01-01T10:00:00.000Z", lastActiveAt: "2026-09-01T10:00:00.000Z" },
  };
}

export function wallet(available: number, overrides: Partial<WalletView> = {}): WalletView {
  return { id: "wallet-1" as WalletId, balance: available, reserved: 0, available, currency: "NGN", simulated: true, ...overrides };
}

/** The core data source with a wallet; every other method fails loudly unless supplied. */
export function fakeDataSource(overrides: Partial<BetNgDataSource> = {}): BetNgDataSource {
  return quietDataSource({ getWallet: async () => wallet(1_000_000), ...overrides });
}

export function resetClientState(): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
}

function loud<T extends object>(name: string, overrides: Partial<T>): T {
  return new Proxy({ ...overrides } as T, {
    get: (target, key) =>
      key in target
        ? target[key as keyof T]
        : () => {
            throw new Error(`${name}.${String(key)} was not expected in this test.`);
          },
  });
}

export interface FakeAccountServices {
  readonly payments?: Partial<PaymentsSource>;
  readonly kyc?: Partial<KycSource>;
  readonly limits?: Partial<LimitsSource>;
  readonly security?: Partial<SecuritySource>;
  readonly devices?: Partial<DevicesSource>;
  readonly profile?: Partial<ProfileSource>;
}

/** Each sub-source answers only what the test supplies; anything else fails the test loudly. */
export function fakeAccountServices(overrides: FakeAccountServices = {}): AccountServicesSource {
  return {
    payments: loud<PaymentsSource>("payments", { listBankAccounts: async () => [], listHistory: async (q) => ({ items: [], page: q?.page ?? 1, pageSize: q?.pageSize ?? 20, total: 0 }), ...overrides.payments }),
    kyc: loud<KycSource>("kyc", overrides.kyc ?? {}),
    limits: loud<LimitsSource>("limits", overrides.limits ?? {}),
    security: loud<SecuritySource>("security", overrides.security ?? {}),
    devices: loud<DevicesSource>("devices", overrides.devices ?? {}),
    profile: loud<ProfileSource>("profile", overrides.profile ?? {}),
  };
}

export const ALL_MONEY_FLAGS: Partial<FeatureFlags> = { paymentsEnabled: true, kycEnabled: true, responsibleGamingEnabled: true, statementsEnabled: true };

export function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    reference: "DEP000123",
    direction: "DEPOSIT",
    status: "PENDING",
    amount: 250_000,
    currency: "NGN",
    method: "CARD",
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
    ...overrides,
  };
}

export function notImplemented(): DataSourceError {
  return new DataSourceError("NOT_IMPLEMENTED", "This service is not available on the platform yet.", { status: 404 });
}

function Shell(): React.JSX.Element {
  const location = useLocation();

  return (
    <>
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
      <Outlet />
    </>
  );
}

export interface RenderMoneyOptions {
  readonly route?: string;
  readonly flags?: Partial<FeatureFlags>;
  readonly services?: AccountServicesSource;
  readonly dataSource?: BetNgDataSource;
  /** Renders this element at `route` instead of the money routes. */
  readonly element?: React.ReactElement;
}

export interface RenderedMoney extends RenderResult {
  readonly queryClient: QueryClient;
}

export function renderMoney(options: RenderMoneyOptions = {}): RenderedMoney {
  __setRuntimeForTests({
    dataSource: options.dataSource ?? fakeDataSource(),
    authSource: fakeAuthSource(session()),
    accountServices: options.services ?? fakeAccountServices(),
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const children: RouteObject[] = options.element === undefined ? moneyRoutes : [{ path: "*", element: options.element }];
  const router = createMemoryRouter([{ path: "/", Component: Shell, children: [{ index: true, element: <h1>Home</h1> }, ...children] }], {
    initialEntries: [options.route ?? "/"],
  });

  const result = render(
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...ALL_MONEY_FLAGS, ...options.flags }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>,
  );

  return Object.assign(result, { queryClient });
}
