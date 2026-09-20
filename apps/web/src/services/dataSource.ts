import { createLiveClient, createRestClient } from "@betng/client-sdk";
import { createMockDataSource, type MockDataSource } from "@betng/mock-data";
import { createPlatformDataSource, type BetNgDataSource, type KeyValueStorage } from "@betng/ui-core";
import { appConfig } from "../configs/app.config";

const storage: KeyValueStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Private mode or quota: the app still runs, just without persistence. */
    }
  },
};

function create(): BetNgDataSource {
  if (appConfig.dataSource === "platform") {
    return createPlatformDataSource({
      rest: createRestClient(appConfig.client),
      openLive: (handlers) => createLiveClient({ config: appConfig.client, handlers }),
      userId: appConfig.userId,
      storage,
    });
  }

  const mock = createMockDataSource({ storage });

  window.addEventListener("offline", () => {
    mock.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    mock.platform.setOnline(true);
  });

  return mock;
}

export const dataSource: BetNgDataSource = create();

export function asMock(source: BetNgDataSource): MockDataSource | undefined {
  return "platform" in source ? (source as MockDataSource) : undefined;
}
