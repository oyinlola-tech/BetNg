import { createLiveClient, createRestClient, type BetNgClientConfig } from "@betng/client-sdk";
import type { ShopSession } from "@betng/contracts";
import { createMockDataSource, createMockShopSource } from "@betng/mock-data";
import { createPlatformDataSource, createPlatformShopSource, createSessionStore, type BetNgDataSource, type SessionStorage, type ShopDataSource } from "@betng/ui-core";
import { appConfig } from "../configs/app.config";

function webStorage(pick: () => Storage): SessionStorage {
  return {
    get: (key) => {
      try {
        return pick().getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        pick().setItem(key, value);
      } catch {
        /* Private mode or quota: the terminal still runs, just without persistence. */
      }
    },
    remove: (key) => {
      try {
        pick().removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

const local = webStorage(() => localStorage);
/* A cashier session ends with the browser tab; it is never written to localStorage. */
const perTab = webStorage(() => sessionStorage);

function create(): { readonly dataSource: BetNgDataSource; readonly shopSource: ShopDataSource } {
  if (appConfig.dataSource === "platform") {
    const session = createSessionStore<ShopSession>("betng.shop.session", perTab);
    const client: BetNgClientConfig = {
      ...appConfig.client,
      getToken: () => session.token(),
      onUnauthorized: () => {
        session.expire();
      },
    };
    const rest = createRestClient(client);

    return {
      dataSource: createPlatformDataSource({ rest, openLive: (handlers) => createLiveClient({ config: client, handlers }), userId: appConfig.userId, storage: local }),
      shopSource: createPlatformShopSource(rest, session),
    };
  }

  const mock = createMockDataSource({ storage: local });

  window.addEventListener("offline", () => {
    mock.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    mock.platform.setOnline(true);
  });

  return { dataSource: mock, shopSource: createMockShopSource({ platform: mock.platform, storage: local, sessionStorage: perTab }) };
}

export const { dataSource, shopSource } = create();
