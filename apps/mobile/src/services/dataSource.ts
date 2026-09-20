import { createLiveClient, createRestClient } from "@betng/client-sdk";
import { createMockDataSource, type MockDataSource } from "@betng/mock-data";
import { createPlatformDataSource, type BetNgDataSource } from "@betng/ui-core";
import { appConfig } from "../configs/app.config";
import { storage } from "./storage";

let instance: BetNgDataSource | undefined;

export function getDataSource(): BetNgDataSource {
  if (instance !== undefined) return instance;

  instance =
    appConfig.dataSource === "platform"
      ? createPlatformDataSource({
          rest: createRestClient(appConfig.client),
          openLive: (handlers) =>
            createLiveClient({ config: appConfig.client, handlers }),
          userId: appConfig.userId,
          storage,
        })
      : createMockDataSource({ storage, latencyMs: 160 });

  return instance;
}

export function asMock(source: BetNgDataSource): MockDataSource | undefined {
  return "platform" in source ? (source as MockDataSource) : undefined;
}
