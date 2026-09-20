import { createLiveClient, createRestClient } from "@betng/client-sdk";
import type { CustomerSession } from "@betng/contracts";
import { createMockAuthSource, createMockDataSource, type MockDataSource } from "@betng/mock-data";
import { createPlatformAuthSource, createPlatformDataSource, createSessionStore, type AuthDataSource, type BetNgDataSource } from "@betng/ui-core";
import { appConfig } from "../configs/app.config";
import { storage } from "./storage";

interface Sources {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
}

let instance: Sources | undefined;

/* The session token sits in the app's AsyncStorage-backed store; a production build should move it to expo-secure-store. */
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

  const mock = createMockDataSource({ storage, latencyMs: 160 });

  return {
    dataSource: mock,
    authSource: createMockAuthSource({ storage, isOnline: () => mock.getConnectionState() !== "OFFLINE" }),
  };
}

function sources(): Sources {
  instance ??= create();

  return instance;
}

export function getDataSource(): BetNgDataSource {
  return sources().dataSource;
}

export function getAuthSource(): AuthDataSource {
  return sources().authSource;
}

export function asMock(source: BetNgDataSource): MockDataSource | undefined {
  return "platform" in source ? (source as MockDataSource) : undefined;
}
