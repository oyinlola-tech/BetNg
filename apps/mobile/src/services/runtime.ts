import type { CustomerSession } from "@betng/contracts";
import {
  DEFAULT_FLAGS,
  configureCurrency,
  configureDateTime,
  createPlatformAuthSource,
  createPlatformClients,
  createPlatformDataSource,
  createSessionStore,
  resolveFlags,
  type AuthDataSource,
  type BetNgDataSource,
  type FeatureFlags,
  type PlatformConfigView,
  type SessionStorage,
} from "@betng/ui-core";
import { env } from "../configs/env";
import { logger } from "./logger";
import { storage } from "./storage";

export interface RuntimeInfo {
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView | undefined;
  readonly mode: "mock" | "platform";
}

/* The customer token is held in memory only: AsyncStorage is not an encrypted store. */
function memoryStorage(): Required<SessionStorage> {
  const values = new Map<string, string>();

  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

let dataSource: BetNgDataSource | undefined;
let authSource: AuthDataSource | undefined;
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

export function getRuntimeInfo(): RuntimeInfo {
  return required(info);
}

async function createSources(): Promise<RuntimeInfo["mode"]> {
  if (env.dataSource === "mock" && (__DEV__ || env.appEnv === "test")) {
    const { createMockSources } = await import("./mockSources");
    const mock = createMockSources(storage);

    dataSource = mock.dataSource;
    authSource = mock.authSource;

    return "mock";
  }

  const session = createSessionStore<CustomerSession>("betng.session.customer", memoryStorage());
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

  dataSource = createPlatformDataSource({
    rest,
    realtime,
    userId: () => session.snapshot().session?.user.id,
    storage,
  });
  authSource = createPlatformAuthSource(rest, session);

  return "platform";
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  const mode = await createSources();
  let config: PlatformConfigView | undefined;

  try {
    config = await getDataSource().getPlatformConfig();
    configureCurrency(config.currency);
    configureDateTime(config.competitionTimezone === undefined ? {} : { competitionTimeZone: config.competitionTimezone });
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = { mode, config, flags: config === undefined ? resolveFlags(undefined, env.flagOverrides) : resolveFlags(config.features, env.flagOverrides) };

  return info;
}

export { DEFAULT_FLAGS };
