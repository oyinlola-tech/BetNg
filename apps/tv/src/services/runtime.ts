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
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
}

/* A display has no account: it reads public data only and never holds a token. */
function createSource(): BetNgDataSource {
  const { rest, realtime } = createPlatformClients({ env, getToken: () => undefined, onUnauthorized: () => undefined, logger });

  return createPlatformDataSource({ rest, realtime, userId: () => undefined, storage });
}

export let dataSource: BetNgDataSource = createSource();

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

export function __setRuntimeForTests(source: BetNgDataSource): void {
  dataSource = source;
  info = undefined;
}
