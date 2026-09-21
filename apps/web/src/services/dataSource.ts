import { createLiveClient, createRestClient } from "@betng/client-sdk";
import type { CustomerSession } from "@betng/contracts";
import { createMockAuthSource, createMockDataSource, type MockDataSource } from "@betng/mock-data";
import {
  createPlatformAuthSource,
  createPlatformDataSource,
  createSessionStore,
  type AuthDataSource,
  type BetNgDataSource,
  type SessionStorage,
} from "@betng/ui-core";
import { appConfig } from "../configs/app.config";

const storage: Required<SessionStorage> = {
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
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
    }
  },
};

interface Sources {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
}

function create(): Sources {
  if (appConfig.dataSource === "platform") {
    const session = createSessionStore<CustomerSession>("betng.session.customer", storage);
    const rest = createRestClient({
      ...appConfig.client,
      getToken: () => session.token(),
      onUnauthorized: () => {
        session.expire();
      },
    });

    return {
      dataSource: createPlatformDataSource({
        rest,
        openLive: (handlers) => createLiveClient({ config: appConfig.client, handlers }),
        userId: () => session.snapshot().session?.user.id,
        storage,
      }),
      authSource: createPlatformAuthSource(rest, session),
    };
  }

  const mock = createMockDataSource({ storage });

  window.addEventListener("offline", () => {
    mock.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    mock.platform.setOnline(true);
  });

  return { dataSource: mock, authSource: createMockAuthSource({ storage, isOnline: () => navigator.onLine }) };
}

export const { dataSource, authSource } = create();

export function asMock(source: BetNgDataSource): MockDataSource | undefined {
  return "platform" in source ? (source as MockDataSource) : undefined;
}
