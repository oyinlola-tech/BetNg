import { createMockDataSource, createMockShopSource } from "@betng/mock-data";
import type { BetNgDataSource, SessionStorage, ShopDataSource } from "@betng/ui-core";

export function createMockSources(
  local: Required<SessionStorage>,
  perTab: Required<SessionStorage>,
): { readonly dataSource: BetNgDataSource; readonly shopSource: ShopDataSource } {
  const dataSource = createMockDataSource({ storage: local });

  window.addEventListener("offline", () => {
    dataSource.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    dataSource.platform.setOnline(true);
  });

  return { dataSource, shopSource: createMockShopSource({ platform: dataSource.platform, storage: local, sessionStorage: perTab }) };
}
