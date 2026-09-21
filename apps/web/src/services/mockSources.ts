import { createMockAuthSource, createMockDataSource } from "@betng/mock-data";
import type { AuthDataSource, BetNgDataSource, SessionStorage } from "@betng/ui-core";

export interface MockSources {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
}

export function createMockSources(storage: {
  readonly session: Required<SessionStorage>;
  readonly local: Required<SessionStorage>;
}): MockSources {
  const dataSource = createMockDataSource({ storage: storage.local });

  window.addEventListener("offline", () => {
    dataSource.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    dataSource.platform.setOnline(true);
  });

  return {
    dataSource,
    authSource: createMockAuthSource({ storage: storage.session, isOnline: () => navigator.onLine }),
  };
}
