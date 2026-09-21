import {
  configureCurrency,
  configureDateTime,
  createPlatformClients,
  createPlatformDataSource,
  resolveFlags,
  type BetNgDataSource,
  type FeatureFlags,
  type PlatformConfigView,
} from "@betng/ui-core";
import { env } from "../configs/env";
import { logger } from "./logger";
import { storage } from "./storage";

export interface RuntimeInfo {
  readonly mode: "mock" | "platform";
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
}

export let dataSource: BetNgDataSource;

let info: RuntimeInfo | undefined;

/* A display has no account: it reads public data only and never holds a token. */
async function createSource(): Promise<RuntimeInfo["mode"]> {
  if (env.dataSource === "mock" && (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "test")) {
    const { createMockSources } = await import("./mockSources");

    dataSource = createMockSources(storage).dataSource;

    return "mock";
  }

  const { rest, realtime } = createPlatformClients({ env, getToken: () => undefined, onUnauthorized: () => undefined, logger });

  dataSource = createPlatformDataSource({ rest, realtime, userId: () => undefined, storage });

  return "platform";
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  const mode = await createSource();
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
