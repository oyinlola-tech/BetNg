import { createMockAdminSource, createMockDataSource } from "@betng/mock-data";
import type { AdminDataSource, BetNgDataSource, SessionStorage } from "@betng/ui-core";

export interface DemoSignIn {
  readonly email: string;
  readonly password: string;
  readonly role: string;
  readonly code?: string;
}

export interface MockSources {
  readonly dataSource: BetNgDataSource;
  readonly adminSource: AdminDataSource;
  readonly demoSignIns: readonly DemoSignIn[];
}

const PASSWORD = "betng-admin";

/* Development sign-ins from docs/frontend.md. This module never reaches a deployed bundle. */
const DEMO_SIGN_INS: readonly DemoSignIn[] = [
  { email: "ops@betng.test", password: PASSWORD, role: "Super admin", code: "246810" },
  { email: "operations@betng.test", password: PASSWORD, role: "Operations" },
  { email: "risk@betng.test", password: PASSWORD, role: "Risk analyst" },
  { email: "support@betng.test", password: PASSWORD, role: "Support" },
];

export function createMockSources(storage: { readonly session: Required<SessionStorage>; readonly local: Required<SessionStorage> }): MockSources {
  const dataSource = createMockDataSource({ storage: storage.local });

  window.addEventListener("offline", () => {
    dataSource.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    dataSource.platform.setOnline(true);
  });

  return {
    dataSource,
    adminSource: createMockAdminSource({ platform: dataSource.platform, storage: storage.local, sessionStorage: storage.session }),
    demoSignIns: DEMO_SIGN_INS,
  };
}
