import { createMockDataSource } from "@betng/mock-data";
import type { BetNgDataSource, KeyValueStorage } from "@betng/ui-core";

export function createMockSources(storage: KeyValueStorage): { readonly dataSource: BetNgDataSource } {
  const dataSource = createMockDataSource({ storage, latencyMs: 80 });

  window.addEventListener("offline", () => {
    dataSource.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    dataSource.platform.setOnline(true);
  });

  return { dataSource };
}
