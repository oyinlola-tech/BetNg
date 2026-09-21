import { createMockAuthSource, createMockDataSource } from "@betng/mock-data";
import type { AuthDataSource, BetNgDataSource, SessionStorage } from "@betng/ui-core";

export function createMockSources(storage: Required<SessionStorage>): {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
} {
  const dataSource = createMockDataSource({ storage, latencyMs: 160 });

  return {
    dataSource,
    authSource: createMockAuthSource({ storage, isOnline: () => dataSource.getConnectionState() !== "OFFLINE" }),
  };
}
