import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from "react-router";
import type { CustomerSession } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  DataSourceError,
  createSessionStore,
  type AccountServicesSource,
  type AuthDataSource,
  type BetNgDataSource,
  type DevicesSource,
  type FeatureFlags,
  type ProfileSource,
  type SecuritySource,
} from "@betng/ui-core";
import { FeatureFlagsProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { AuthDialog } from "../../src/features/auth";
import { accountRoutes, authRoutes } from "../../src/routes/account.routes";
import { legalRoutes } from "../../src/routes/legal.routes";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { fakeDataSource, testSession } from "./account";

function unexpected(name: string) {
  return (): never => {
    throw new DataSourceError("NOT_IMPLEMENTED", `${name} was not expected in this test.`);
  };
}

/** Every auth method, with sign-in succeeding by default; tests override what they exercise. */
export function fullAuthSource(options: { readonly signedIn?: boolean; readonly session?: CustomerSession } = {}): AuthDataSource {
  const session = createSessionStore<CustomerSession>("test.security.session");

  if (options.signedIn === true) session.set(options.session ?? testSession());

  const open = async (): Promise<CustomerSession> => {
    const next = testSession();

    session.set(next);

    return next;
  };

  return {
    session,
    register: unexpected("register"),
    verify: unexpected("verify"),
    resendVerification: unexpected("resendVerification"),
    login: open,
    completeTwoFactor: open,
    logout: async () => {
      session.clear();
    },
    requestPasswordReset: async () => undefined,
    confirmPasswordReset: async () => undefined,
  };
}

export function fakeAccountServices(overrides: { readonly security?: Partial<SecuritySource>; readonly devices?: Partial<DevicesSource>; readonly profile?: Partial<ProfileSource> } = {}): AccountServicesSource {
  const proxy = <T extends object>(name: string, partial: Partial<T>): T =>
    new Proxy(partial as T, { get: (target, key) => (key in target ? target[key as keyof T] : unexpected(`${name}.${String(key)}`)) });

  return {
    payments: proxy("payments", {}),
    kyc: proxy("kyc", {}),
    limits: proxy("limits", {}),
    security: proxy<SecuritySource>("security", overrides.security ?? {}),
    devices: proxy<DevicesSource>("devices", overrides.devices ?? {}),
    profile: proxy<ProfileSource>("profile", overrides.profile ?? {}),
  };
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

export interface RenderSecurityOptions {
  readonly route?: string;
  readonly dataSource?: BetNgDataSource;
  readonly authSource?: AuthDataSource;
  readonly accountServices?: AccountServicesSource;
  readonly flags?: Partial<FeatureFlags>;
  readonly routes?: readonly RouteObject[];
}

export interface RenderedSecurity extends RenderResult {
  readonly authSource: AuthDataSource;
  readonly queryClient: QueryClient;
}

export const ALL_ACCOUNT_FLAGS: Partial<FeatureFlags> = {
  twoFactorEnabled: true,
  accountSessionsEnabled: true,
  notificationChannelsEnabled: true,
  accountDeletionEnabled: true,
};

export function renderSecurity(options: RenderSecurityOptions = {}): RenderedSecurity {
  const authSource = options.authSource ?? fullAuthSource({ signedIn: true });

  __setRuntimeForTests({ dataSource: options.dataSource ?? fakeDataSource(), authSource, accountServices: options.accountServices ?? fakeAccountServices() });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/", Component: Shell, children: [{ index: true, element: <h1>Home</h1> }, ...(options.routes ?? []), ...accountRoutes, ...authRoutes, ...legalRoutes] }],
    { initialEntries: [options.route ?? "/"] },
  );

  const result = render(
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...ALL_ACCOUNT_FLAGS, ...options.flags }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>,
  );

  return Object.assign(result, { authSource, queryClient });
}
