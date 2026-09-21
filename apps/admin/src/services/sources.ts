import { createLiveClient, createRestClient } from "@betng/client-sdk";
import type { AdminSession } from "@betng/contracts";
import { createMockAdminSource, createMockDataSource } from "@betng/mock-data";
import { createPlatformAdminSource, createPlatformDataSource, createSessionStore, type AdminDataSource, type BetNgDataSource, type SessionStorage } from "@betng/ui-core";
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
      }
    },
    remove: (key) => {
      try {
        pick().removeItem(key);
      } catch {
      }
    },
  };
}

// The admin token lives for the tab only; closing it signs the operator out.
const tabStorage = webStorage(() => sessionStorage);
const localState = webStorage(() => localStorage);

interface Sources {
  readonly dataSource: BetNgDataSource;
  readonly adminSource: AdminDataSource;
}

function create(): Sources {
  if (appConfig.dataSource === "platform") {
    const session = createSessionStore<AdminSession>("betng.admin.session", tabStorage);
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
        userId: () => undefined,
        storage: localState,
      }),
      adminSource: createPlatformAdminSource(rest, session),
    };
  }

  const mock = createMockDataSource({ storage: localState });

  window.addEventListener("offline", () => {
    mock.platform.setOnline(false);
  });
  window.addEventListener("online", () => {
    mock.platform.setOnline(true);
  });

  return { dataSource: mock, adminSource: createMockAdminSource({ platform: mock.platform, storage: localState, sessionStorage: tabStorage }) };
}

export const { dataSource, adminSource } = create();
