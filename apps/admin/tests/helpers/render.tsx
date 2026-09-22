import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router";
import type { AdminPermission } from "@betng/contracts";
import { DEFAULT_FLAGS, type AdminDataSource, type BetNgDataSource, type ComplianceDataSource, type FeatureFlags } from "@betng/ui-core";
import { FeatureFlagsProvider, ThemeProvider, ToastProvider } from "@betng/ui-web";
import { routes } from "../../src/routes";
import { __setRuntimeForTests } from "../../src/services/runtime";
import { ALL_PERMISSIONS, fakeAdminSource, fakeCompliance, fakeDataSource, session, type FakeAdminSource, type FakeCompliance } from "./sources";

export interface RenderOptions {
  readonly path?: string;
  readonly permissions?: readonly AdminPermission[];
  readonly signedIn?: boolean;
  readonly admin?: Partial<Record<keyof AdminDataSource, unknown>>;
  readonly data?: Partial<Record<keyof BetNgDataSource, unknown>>;
  readonly routes?: RouteObject[];
  readonly compliance?: Partial<Record<keyof ComplianceDataSource, unknown>>;
  readonly flags?: Partial<FeatureFlags>;
  readonly twoFactorEnabled?: boolean;
}

export interface Rendered extends RenderResult {
  readonly adminSource: FakeAdminSource;
  readonly compliance: FakeCompliance;
  readonly router: ReturnType<typeof createMemoryRouter>;
}

/* The console lays out for a desktop: the sidebar is rendered, not the drawer. */
export function desktopViewport(): void {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes("min-width"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

export function Providers({ children, flags }: { readonly children: React.ReactNode; readonly flags?: Partial<FeatureFlags> | undefined }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  return (
    <FeatureFlagsProvider flags={{ ...DEFAULT_FLAGS, ...flags }}>
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </FeatureFlagsProvider>
  );
}

export function installSources(options: RenderOptions = {}): FakeAdminSource {
  return installAll(options).adminSource;
}

function installAll(options: RenderOptions): { readonly adminSource: FakeAdminSource; readonly compliance: FakeCompliance } {
  const adminSource = fakeAdminSource(options.admin);
  const compliance = fakeCompliance(options.compliance);

  if (options.signedIn !== false) adminSource.session.set(session(options.permissions ?? ALL_PERMISSIONS, "SUPER_ADMIN", options.twoFactorEnabled ?? true));

  __setRuntimeForTests({ adminSource, compliance, dataSource: fakeDataSource(options.data) });

  return { adminSource, compliance };
}

export function renderConsole(options: RenderOptions = {}): Rendered {
  desktopViewport();

  const { adminSource, compliance } = installAll(options);
  const router = createMemoryRouter(options.routes ?? routes, { initialEntries: [options.path ?? "/"] });
  const result = render(
    <Providers flags={options.flags}>
      <RouterProvider router={router} />
    </Providers>,
  );

  return { ...result, adminSource, compliance, router };
}
