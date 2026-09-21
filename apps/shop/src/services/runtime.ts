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
import type { DemoTerminal } from "./mockSources";
import { local, perTab } from "./storage";

export interface RuntimeInfo {
  readonly mode: "mock" | "platform";
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
}

export let dataSource: BetNgDataSource;
export let shopSource: ShopDataSource;
export let demoTerminal: DemoTerminal | undefined;

let info: RuntimeInfo | undefined;

async function createSources(): Promise<RuntimeInfo["mode"]> {
  if (env.dataSource === "mock" && (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "test")) {
    const { createMockSources } = await import("./mockSources");
    const mock = createMockSources(local, perTab);

    dataSource = mock.dataSource;
    shopSource = mock.shopSource;
    demoTerminal = mock.demo;

    return "mock";
  }

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

  session.subscribe(() => {
    const token = session.token();

    if (token !== lastToken) {
      lastToken = token;
      realtime.replaceConnection();
    }
  });

  dataSource = createPlatformDataSource({ rest, realtime, userId: () => undefined, storage: local });
  shopSource = createPlatformShopSource(rest, session);

  return "platform";
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  const mode = await createSources();
  let config: PlatformConfigView | undefined;

  try {
    config = await dataSource.getPlatformConfig();
    configureCurrency(config.currency);
    configureDateTime(config.competitionTimezone === undefined ? {} : { competitionTimeZone: config.competitionTimezone });
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = { mode, config, flags: resolveFlags(config?.features, env.flagOverrides) };

  return info;
}

export function getRuntimeInfo(): RuntimeInfo {
  if (info === undefined) throw new Error("initRuntime() has not completed.");

  return info;
}

export function isMock(): boolean {
  return info?.mode === "mock";
}
