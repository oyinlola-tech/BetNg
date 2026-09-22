import type { CustomerSession } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  configureCurrency,
  configureDateTime,
  createPlatformAccountServices,
  createPlatformAuthSource,
  createPlatformClients,
  createPlatformDataSource,
  createSessionStore,
  resolveFlags,
  type AccountServicesSource,
  type AuthDataSource,
  type BetNgDataSource,
  type FeatureFlags,
  type PlatformConfigView,
} from "@betng/ui-core";
import { env } from "../configs/env";
import { logger } from "./logger";
import { removeStored, storage } from "./storage";
import { secureStorage } from "../platform";
import { withOfflineCache } from "../platform/cachedDataSource";
import { createOfflineCache } from "../platform/offlineCache";
import { createSecureSessionStorage } from "../platform/secureStorage";

export interface RuntimeInfo {
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
}

const SESSION_KEY = "betng.session.customer";
const secureSession = createSecureSessionStorage(secureStorage, (operation) => {
  logger.warn("flow", `Secure storage ${operation} failed.`);
});
const offlineCache = createOfflineCache(storage);

let dataSource: BetNgDataSource | undefined;
let authSource: AuthDataSource | undefined;
let accountServices: AccountServicesSource | undefined;
let info: RuntimeInfo | undefined;

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("initRuntime() has not completed.");

  return value;
}

export function getDataSource(): BetNgDataSource {
  return required(dataSource);
}

export function getAuthSource(): AuthDataSource {
  return required(authSource);
}

export function getAccountServices(): AccountServicesSource {
  return required(accountServices);
}

export function getRuntimeInfo(): RuntimeInfo {
  return required(info);
}

async function createSources(): Promise<void> {
  if (!secureStorage.persistent) logger.warn("flow", "Secure storage is unavailable in this build; the session will not persist across restarts.");

  removeStored(SESSION_KEY);
  await secureSession.hydrate([SESSION_KEY]);

  const session = createSessionStore<CustomerSession>(SESSION_KEY, secureSession.storage);
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

  dataSource = withOfflineCache(
    createPlatformDataSource({
      rest,
      realtime,
      userId: () => session.snapshot().session?.user.id,
      storage,
      accountChannel: env.realtimeAuth !== "none",
    }),
    offlineCache,
  );
  authSource = createPlatformAuthSource(rest, session);
  accountServices = createPlatformAccountServices(rest, session, { uploadHosts: env.uploadHosts });
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  await createSources();
  let config: PlatformConfigView | undefined;

  try {
    config = await getDataSource().getPlatformConfig();
    configureCurrency(config.currency);
    configureDateTime(config.competitionTimezone === undefined ? {} : { competitionTimeZone: config.competitionTimezone });
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = { config, flags: config === undefined ? resolveFlags(undefined, env.flagOverrides) : resolveFlags(config.features, env.flagOverrides) };

  return info;
}

export { DEFAULT_FLAGS };
