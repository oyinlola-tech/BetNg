import { createMockDataSource, createMockShopSource } from "@betng/mock-data";
import type { BetNgDataSource, SessionStorage, ShopDataSource } from "@betng/ui-core";

export interface DemoTerminal {
  readonly shopCode: string;
  readonly password: string;
  readonly pin: string;
  readonly users: readonly { readonly username: string; readonly role: string }[];
}

/** Development sign-ins for the stand-in shop. Kept here so no production bundle carries them. */
const DEMO_TERMINAL: DemoTerminal = {
  shopCode: "BNG-LAG-001",
  password: "betng-demo",
  pin: "1234",
  users: [
    { username: "ada", role: "owner" },
    { username: "tunde", role: "manager" },
    { username: "bisi", role: "cashier" },
    { username: "kunle", role: "suspended" },
  ],
};

export function createMockSources(
  local: Required<SessionStorage>,
  perTab: Required<SessionStorage>,
): {
  readonly dataSource: BetNgDataSource;
  readonly shopSource: ShopDataSource;
  readonly demo: DemoTerminal;
} {
  const dataSource = createMockDataSource({ storage: local });

  window.addEventListener("offline", () => {
    dataSource.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    dataSource.platform.setOnline(true);
  });

  return {
    dataSource,
    shopSource: createMockShopSource({ platform: dataSource.platform, storage: local, sessionStorage: perTab }),
    demo: DEMO_TERMINAL,
  };
}
