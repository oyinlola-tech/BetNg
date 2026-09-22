import type { ShopSession } from "@betng/contracts";
import {
  configureCurrency,
  configureDateTime,
  createPlatformClients,
  createPlatformDataSource,
  createPlatformShopSource,
  createSessionStore,
  resolveFlags,
  type BetNgDataSource,
  type FeatureFlags,
  type PlatformConfigView,
  type ShopDataSource,
} from "@betng/ui-core";
import { env } from "../configs/env";
import { logger } from "./logger";
import { local, perTab } from "./storage";

export interface RuntimeInfo {
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
}

function createSources(): { readonly dataSource: BetNgDataSource; readonly shopSource: ShopDataSource } {
  const session = createSessionStore<ShopSession>("betng.shop.session", perTab);
  const { rest, realtime } = createPlatformClients({
    env,
    getToken: () => session.token(),
    onUnauthorized: () => {
      session.expire();
    },
    logger,
  });

  let lastToken = session.token();

  if (env.realtimeAuth !== "none") session.subscribe(() => {
    const token = session.token();

    if (token !== lastToken) {
      lastToken = token;
      realtime.replaceConnection();
    }
  });

  return {
    dataSource: createPlatformDataSource({ rest, realtime, userId: () => undefined, storage: local }),
    shopSource: createPlatformShopSource(rest, session),
  };
}

const platform = createSources();

export let dataSource: BetNgDataSource = platform.dataSource;
export let shopSource: ShopDataSource = platform.shopSource;

let info: RuntimeInfo | undefined;

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  let config: PlatformConfigView | undefined;

  try {
    config = await dataSource.getPlatformConfig();
    configureCurrency(config.currency);
    configureDateTime(config.competitionTimezone === undefined ? {} : { competitionTimeZone: config.competitionTimezone });
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = { config, flags: resolveFlags(config?.features, env.flagOverrides) };

  return info;
}

export function getRuntimeInfo(): RuntimeInfo {
  if (info === undefined) throw new Error("initRuntime() has not completed.");

  return info;
}

export function __setRuntimeForTests(sources: { readonly dataSource: BetNgDataSource; readonly shopSource: ShopDataSource }): void {
  dataSource = sources.dataSource;
  shopSource = sources.shopSource;
  info = undefined;
}
